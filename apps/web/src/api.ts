import type { Recipe, RecipeDetail, RecipeListItem } from "@recipe/recipe-core"

export type ImportEvent =
    | { status: "scraping" }
    | { status: "parsing" }
    | { status: "done"; recipeId: string }
    | { status: "error"; message: string }

export function importRecipe(url: string, onEvent: (event: ImportEvent) => void): () => void {
    const controller = new AbortController()

    void fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal,
    }).then(async (res) => {
        const reader = res.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split("\n\n")
            buffer = parts.pop() ?? ""

            for (const part of parts) {
                const line = part.trim()
                if (line.startsWith("data: ")) {
                    try {
                        const event = JSON.parse(line.slice(6)) as ImportEvent
                        onEvent(event)
                    } catch {
                        // ignore malformed SSE lines
                    }
                }
            }
        }
    })

    return () => controller.abort()
}

export async function listRecipes(): Promise<RecipeListItem[]> {
    const res = await fetch("/api/recipes")
    if (!res.ok) throw new Error("Failed to fetch recipes")
    return res.json()
}

export async function getRecipe(id: string): Promise<RecipeDetail> {
    const res = await fetch(`/api/recipes/${id}`)
    if (!res.ok) throw new Error("Recipe not found")
    return res.json()
}

export async function editPreview(recipeId: string, prompt: string, currentRecipe: Recipe): Promise<Recipe> {
    const res = await fetch(`/api/recipes/${recipeId}/edit-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, currentRecipe }),
    })
    if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? "Edit preview failed")
    }
    return res.json()
}

export async function commitVersion(
    recipeId: string,
    recipe: Recipe,
    editPrompt: string,
    originalRecipe?: Recipe
): Promise<{ versionId: string }> {
    const res = await fetch(`/api/recipes/${recipeId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe, editPrompt, originalRecipe }),
    })
    if (!res.ok) throw new Error("Failed to commit version")
    return res.json()
}

export async function setDefault(recipeId: string, versionId: string): Promise<void> {
    await fetch(`/api/recipes/${recipeId}/default`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
    })
}

export async function printRecipe(recipeId: string): Promise<void> {
    const res = await fetch(`/api/recipes/${recipeId}/print`, {
        method: "POST",
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error ?? "Print failed")
}

export async function deleteRecipe(recipeId: string): Promise<void> {
    const res = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete recipe")
}

export async function getTags(): Promise<{ id: string; name: string }[]> {
    const res = await fetch("/api/tags")
    if (!res.ok) throw new Error("Failed to fetch tags")
    return res.json()
}

export async function createTag(name: string): Promise<{ id: string; name: string }> {
    const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error("Failed to create tag")
    return res.json()
}

export async function deleteTag(id: string): Promise<void> {
    const res = await fetch(`/api/tags/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Failed to delete tag")
}
