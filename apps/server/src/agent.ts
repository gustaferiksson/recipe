import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import { type Recipe, RecipeSchema } from "@recipe/recipe-core"
import { generateObject, generateText } from "ai"

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

export async function editRecipe(currentRecipe: Recipe, prompt: string, tags: string[] = []): Promise<Recipe> {
    const tagInstruction = buildTagInstruction(tags)
    const { object } = await generateObject({
        model,
        schema: AIRecipeSchema,
        prompt: `You are editing a recipe based on a user's request. Return the complete modified recipe.

User request: ${prompt}

Current recipe:
${JSON.stringify(currentRecipe, null, 2)}

Apply the requested changes and return the full recipe. Preserve all fields not affected by the change.${tagInstruction ? `\n${tagInstruction}` : ""}`,
    })

    return { ...object, sourceUrl: currentRecipe.sourceUrl, scrapedAt: currentRecipe.scrapedAt }
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
