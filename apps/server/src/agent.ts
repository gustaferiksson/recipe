import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import { type Recipe, RecipeSchema } from "@recipe/recipe-core"
import { generateObject } from "ai"

const bedrock = createAmazonBedrock({
    region: process.env.AWS_REGION ?? "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
})

const model = bedrock("amazon.nova-pro-v1:0")

// Omit server-managed fields so the AI doesn't have to generate valid URLs/datetimes
const AIRecipeSchema = RecipeSchema.omit({ scrapedAt: true, sourceUrl: true })

export async function parseRecipeFromMarkdown(markdown: string, sourceUrl: string, scrapedAt: string): Promise<Recipe> {
    const { object } = await generateObject({
        model,
        schema: AIRecipeSchema,
        prompt: `Extract the recipe from the following web page content. The source URL is ${sourceUrl}.

Return all fields you can find:
- Parse ingredient quantity and unit when possible
- Return each step as a separate string in order
- Set cuisine to the culinary tradition (e.g. Italian, Thai, Mexican)
- Set category to the meal type (e.g. Main Course, Dessert, Appetizer, Breakfast, Bread)
- Set tags to relevant descriptors:
    occasion (weeknight, holiday, meal-prep)
    protein (meat, pork, fish)

Page content:
${markdown}`,
    })

    return { ...object, sourceUrl, scrapedAt }
}

export async function editRecipe(currentRecipe: Recipe, prompt: string): Promise<Recipe> {
    const { object } = await generateObject({
        model,
        schema: AIRecipeSchema,
        prompt: `You are editing a recipe based on a user's request. Return the complete modified recipe.

User request: ${prompt}

Current recipe:
${JSON.stringify(currentRecipe, null, 2)}

Apply the requested changes and return the full recipe. Preserve all fields not affected by the change.`,
    })

    return { ...object, sourceUrl: currentRecipe.sourceUrl, scrapedAt: currentRecipe.scrapedAt }
}
