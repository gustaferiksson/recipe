import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import { type Recipe, RecipeSchema, IngredientSchema } from "@recipe/recipe-core"
import { generateObject, generateText, stepCountIs, tool } from "ai"
import { z } from "zod"

const bedrock = createAmazonBedrock({
    region: process.env.AWS_REGION ?? "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
})

const model = bedrock("amazon.nova-pro-v1:0")

// Omit server-managed fields so the AI doesn't have to generate valid URLs/datetimes
const AIRecipeSchema = RecipeSchema.omit({ scrapedAt: true, sourceUrl: true })

function buildTagInstruction(tags: string[]): string {
    if (tags.length === 0) return ""
    return `- Set tags by picking only from this list: [${tags.join(", ")}]. Leave tags empty if none apply.`
}

export type EditAgentEvent =
    | { type: "progress"; label: string }
    | { type: "clarification"; question: string }
    | { type: "result"; recipe: Recipe }
    | { type: "error"; message: string }

export type ConversationMessage = { role: "user" | "assistant"; content: string }

export async function parseRecipeFromMarkdown(
    markdown: string,
    sourceUrl: string,
    scrapedAt: string,
    tags: string[] = []
): Promise<Recipe> {
    const tagInstruction = buildTagInstruction(tags)
    const { object } = await generateObject({
        model,
        schema: AIRecipeSchema,
        prompt: `Extract the recipe from the following web page content. The source URL is ${sourceUrl}.

Return all fields you can find:
- Parse ingredient quantity and unit when possible
- Return each step as a separate string in order
- Set cuisine to the culinary tradition (e.g. Italian, Thai, Mexican)
- Set category to the meal type (e.g. Main Course, Dessert, Appetizer, Breakfast, Bread)${tagInstruction ? `\n- ${tagInstruction.slice(2)}` : ""}

Page content:
${markdown}`,
    })

    return { ...object, sourceUrl, scrapedAt }
}

export async function agentEditRecipe(
    currentRecipe: Recipe,
    history: ConversationMessage[],
    prompt: string,
    tags: string[],
    onEvent: (event: EditAgentEvent) => void
): Promise<void> {
    const tagInstruction = buildTagInstruction(tags)
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort("timeout"), 10_000)

    let clarificationQuestion: string | null = null
    let finalRecipe: Recipe = { ...currentRecipe }
    let recipeMutated = false

    const systemPrompt = `You are a recipe editor. Modify the recipe based on the user's request using the provided tools.

Current recipe:
${JSON.stringify(currentRecipe, null, 2)}

Rules:
- When adding, removing, or changing an ingredient, you MUST call both update_ingredients AND update_steps
- Always call review_recipe as your final action with the complete modified recipe
- Call ask_clarification ONLY if the request is completely unintelligible — if you can make a reasonable assumption, proceed without asking${tagInstruction ? `\n- ${tagInstruction}` : ""}`

    try {
        await generateText({
            model,
            stopWhen: stepCountIs(5),
            abortSignal: abortController.signal,
            system: systemPrompt,
            messages: [
                ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
                { role: "user" as const, content: prompt },
            ],
            tools: {
                update_ingredients: tool({
                    description: "Update the recipe's ingredients list",
                    inputSchema: z.object({
                        ingredients: IngredientSchema.array().describe("The complete updated ingredients list"),
                    }),
                    execute: async ({ ingredients }) => {
                        finalRecipe = { ...finalRecipe, ingredients }
                        recipeMutated = true
                        onEvent({ type: "progress", label: "Updating ingredients..." })
                        return "Ingredients updated"
                    },
                }),
                update_steps: tool({
                    description: "Update the recipe's preparation steps",
                    inputSchema: z.object({
                        steps: z.string().array().describe("The complete updated steps list in order"),
                    }),
                    execute: async ({ steps }) => {
                        finalRecipe = { ...finalRecipe, steps }
                        recipeMutated = true
                        onEvent({ type: "progress", label: "Updating steps..." })
                        return "Steps updated"
                    },
                }),
                update_metadata: tool({
                    description: "Update recipe metadata: title, servings, prep/cook times, cuisine, category, or tags",
                    inputSchema: z.object({
                        title: z.string().optional(),
                        servings: z.number().optional(),
                        prepTime: z.number().optional(),
                        cookTime: z.number().optional(),
                        cuisine: z.string().optional(),
                        category: z.string().optional(),
                        tags: z.string().array().optional(),
                    }),
                    execute: async (fields) => {
                        const updates = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))
                        finalRecipe = { ...finalRecipe, ...updates }
                        recipeMutated = true
                        onEvent({ type: "progress", label: "Updating recipe details..." })
                        return "Metadata updated"
                    },
                }),
                ask_clarification: tool({
                    description:
                        "Ask the user for clarification when their request is too unclear to proceed. Only use this if you cannot make any reasonable assumption.",
                    inputSchema: z.object({
                        question: z.string().describe("The clarification question to ask the user"),
                    }),
                    execute: async ({ question }) => {
                        clarificationQuestion = question
                        abortController.abort("clarification")
                        return "Waiting for clarification"
                    },
                }),
                review_recipe: tool({
                    description:
                        "Review and finalize the complete recipe for consistency. Always call this last with the full modified recipe.",
                    inputSchema: z.object({
                        recipe: AIRecipeSchema,
                    }),
                    execute: async ({ recipe }) => {
                        finalRecipe = { ...recipe, sourceUrl: currentRecipe.sourceUrl, scrapedAt: currentRecipe.scrapedAt }
                        recipeMutated = true
                        onEvent({ type: "progress", label: "Reviewing consistency..." })
                        return "Recipe finalized"
                    },
                }),
            },
        })
    } catch {
        // Expected: AbortError from timeout or clarification — handled below
    } finally {
        clearTimeout(timeoutId)
    }

    if (clarificationQuestion) {
        onEvent({ type: "clarification", question: clarificationQuestion })
    } else if (abortController.signal.aborted && abortController.signal.reason === "timeout") {
        onEvent({ type: "error", message: "Edit timed out. Please try a simpler request." })
    } else if (!recipeMutated) {
        onEvent({ type: "error", message: "Agent could not process this request. Please try rephrasing." })
    } else {
        onEvent({ type: "result", recipe: finalRecipe })
    }
}

export async function generateVersionName(
    editPrompt: string,
    originalRecipe: Recipe,
    editedRecipe: Recipe
): Promise<string> {
    const { text } = await generateText({
        model,
        prompt: `Given this edit instruction and what changed in the recipe, return a short (2-5 word) title describing the version. No quotes.
Examples: Vegetarian Adaptation, Halved Servings, Gluten-Free Version

Edit instruction: ${editPrompt}
Original recipe: ${originalRecipe.title}
Edited recipe: ${editedRecipe.title}

Return only the version name, nothing else.`,
    })
    return text.trim()
}
