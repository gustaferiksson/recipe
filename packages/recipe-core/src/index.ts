import { z } from "zod"

export const IngredientSchema = z.object({
    name: z.string(),
    quantity: z.number().optional(),
    unit: z.string().optional(),
    preparation: z.string().optional(),
})

export const RecipeSchema = z.object({
    title: z.string(),
    servings: z.number().optional(),
    prepTime: z.number().optional(), // minutes
    cookTime: z.number().optional(), // minutes
    ingredients: z.array(IngredientSchema),
    steps: z.array(z.string()),
    tags: z.array(z.string()).optional(),
    cuisine: z.string().optional(),
    category: z.string().optional(),
    sourceUrl: z.string().url(),
    scrapedAt: z.string().datetime(),
})

export type Ingredient = z.infer<typeof IngredientSchema>
export type Recipe = z.infer<typeof RecipeSchema>

export type IngredientDiff =
    | { type: "added"; ingredient: Ingredient }
    | { type: "removed"; ingredient: Ingredient }
    | { type: "modified"; before: Ingredient; after: Ingredient }

// DB row shapes (what the server reads/writes to SQLite)
export interface RecipeRow {
    id: string
    source_url: string
    scraped_at: string
    original_json: string
    default_version_id: string | null
    image_path: string | null
    created_at: string
}

export interface RecipeVersionRow {
    id: string
    recipe_id: string
    recipe_json: string
    edit_prompt: string | null
    name: string | null
    changeset: string | null
    created_at: string
}

// API response shapes
export interface RecipeListItem {
    id: string
    title: string
    cuisine: string | undefined
    imagePath: string | null
    defaultVersionId: string | null
    versionCount: number
    createdAt: string
}

export interface RecipeDetail {
    id: string
    sourceUrl: string
    scrapedAt: string
    imagePath: string | null
    defaultVersionId: string | null
    originalRecipe: Recipe
    versions: Array<{
        id: string
        recipe: Recipe
        editPrompt: string | null
        name: string | null
        changeset: IngredientDiff[] | null
        createdAt: string
    }>
}
