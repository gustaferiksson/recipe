import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { Recipe, RecipeDetail, RecipeListItem, RecipeRow, RecipeVersionRow } from "@recipe/recipe-core"
import { RecipeSchema } from "@recipe/recipe-core"
import { editRecipe, parseRecipeFromMarkdown } from "./agent"
import { db, IMAGES_DIR } from "./db"
import { printRecipe } from "./printer"
import { downloadImage, scrapeUrl } from "./scraper"

const PORT = Number(process.env.PORT ?? 3001)

function newId(): string {
    return crypto.randomUUID()
}

function now(): string {
    return new Date().toISOString()
}

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

function error(message: string, status = 400): Response {
    return json({ error: message }, status)
}

function cors(res: Response): Response {
    res.headers.set("Access-Control-Allow-Origin", "*")
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
    res.headers.set("Access-Control-Allow-Headers", "Content-Type")
    return res
}

// ─── Route handlers ──────────────────────────────────────────────────────────

async function handleImport(req: Request): Promise<Response> {
    const body = (await req.json()) as { url?: string }
    if (!body.url) return error("url is required")
    const url = body.url

    const recipeId = newId()
    const createdAt = now()

    const stream = new ReadableStream({
        async start(controller) {
            function send(data: Record<string, unknown>) {
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))
            }

            let imagePath: string | null = null
            try {
                // Duplicate URL check
                const existing = db
                    .query<{ id: string }, [string]>(`SELECT id FROM recipes WHERE source_url = ?`)
                    .get(url)
                if (existing) {
                    send({ status: "error", message: "This URL has already been imported." })
                    return
                }

                send({ status: "scraping" })
                const { markdown, ogImageUrl } = await scrapeUrl(url)

                // Download og:image if present (non-fatal)
                if (ogImageUrl) {
                    const ext = ogImageUrl.split("?")[0].split(".").at(-1) ?? "jpg"
                    const filename = `${recipeId}.${ext}`
                    try {
                        await downloadImage(ogImageUrl, path.join(IMAGES_DIR, filename), url)
                        imagePath = filename
                    } catch {
                        // Image failure doesn't block import
                    }
                }

                send({ status: "parsing" })
                const recipe = await parseRecipeFromMarkdown(markdown, url, createdAt)

                const versionId = newId()
                db.transaction(() => {
                    db.run(
                        `INSERT INTO recipes (id, source_url, scraped_at, original_json, default_version_id, image_path, created_at)
                 VALUES (?, ?, ?, ?, NULL, ?, ?)`,
                        [recipeId, url, createdAt, JSON.stringify(recipe), imagePath, createdAt]
                    )
                    db.run(
                        `INSERT INTO recipe_versions (id, recipe_id, recipe_json, edit_prompt, created_at)
                 VALUES (?, ?, ?, NULL, ?)`,
                        [versionId, recipeId, JSON.stringify(recipe), createdAt]
                    )
                    db.run(`UPDATE recipes SET default_version_id = ? WHERE id = ?`, [versionId, recipeId])
                })()

                send({ status: "done", recipeId })
            } catch (err) {
                // Clean up image if it was saved before the failure
                if (imagePath) {
                    try {
                        fs.unlinkSync(path.join(IMAGES_DIR, imagePath))
                    } catch {
                        /* ignore */
                    }
                }
                send({
                    status: "error",
                    message: err instanceof Error ? err.message : String(err),
                })
            } finally {
                controller.close()
            }
        },
    })

    return cors(
        new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "Access-Control-Allow-Origin": "*",
            },
        })
    )
}

function handleListRecipes(): Response {
    const rows = db
        .query<
            {
                id: string
                default_version_id: string | null
                image_path: string | null
                created_at: string
                recipe_json: string
                version_count: number
            },
            []
        >(
            `SELECT r.id, r.default_version_id, r.image_path, r.created_at,
              v.recipe_json,
              (SELECT COUNT(*) FROM recipe_versions rv WHERE rv.recipe_id = r.id) AS version_count
       FROM recipes r
       LEFT JOIN recipe_versions v ON v.id = r.default_version_id
       ORDER BY r.created_at DESC`
        )
        .all()

    const items: RecipeListItem[] = rows.map((row) => {
        const recipe = JSON.parse(row.recipe_json ?? "{}") as Partial<Recipe>
        return {
            id: row.id,
            title: recipe.title ?? "Untitled",
            cuisine: recipe.cuisine,
            imagePath: row.image_path,
            defaultVersionId: row.default_version_id,
            versionCount: row.version_count,
            createdAt: row.created_at,
        }
    })

    return cors(json(items))
}

function handleGetRecipe(id: string): Response {
    const recipe = db.query<RecipeRow, [string]>(`SELECT * FROM recipes WHERE id = ?`).get(id)

    if (!recipe) return cors(error("Recipe not found", 404))

    const versions = db
        .query<RecipeVersionRow, [string]>(`SELECT * FROM recipe_versions WHERE recipe_id = ? ORDER BY created_at ASC`)
        .all(id)

    const detail: RecipeDetail = {
        id: recipe.id,
        sourceUrl: recipe.source_url,
        scrapedAt: recipe.scraped_at,
        imagePath: recipe.image_path,
        defaultVersionId: recipe.default_version_id,
        originalRecipe: JSON.parse(recipe.original_json),
        versions: versions.map((v) => ({
            id: v.id,
            recipe: JSON.parse(v.recipe_json),
            editPrompt: v.edit_prompt,
            createdAt: v.created_at,
        })),
    }

    return cors(json(detail))
}

async function handleEditPreview(req: Request): Promise<Response> {
    const body = (await req.json()) as {
        prompt?: string
        currentRecipe?: Recipe
    }

    if (!body.prompt) return error("prompt is required")
    if (!body.currentRecipe) return error("currentRecipe is required")

    const parsed = RecipeSchema.safeParse(body.currentRecipe)
    if (!parsed.success) return error("currentRecipe is invalid")

    const proposed = await editRecipe(parsed.data, body.prompt)
    return cors(json(proposed))
}

async function handleCommitVersion(req: Request, recipeId: string): Promise<Response> {
    const exists = db.query<{ id: string }, [string]>(`SELECT id FROM recipes WHERE id = ?`).get(recipeId)
    if (!exists) return cors(error("Recipe not found", 404))

    const body = (await req.json()) as {
        recipe?: Recipe
        editPrompt?: string
    }
    if (!body.recipe) return error("recipe is required")

    const parsed = RecipeSchema.safeParse(body.recipe)
    if (!parsed.success) return error("recipe is invalid")

    const versionId = newId()
    const createdAt = now()

    db.run(
        `INSERT INTO recipe_versions (id, recipe_id, recipe_json, edit_prompt, created_at)
     VALUES (?, ?, ?, ?, ?)`,
        [versionId, recipeId, JSON.stringify(parsed.data), body.editPrompt ?? null, createdAt]
    )
    db.run(`UPDATE recipes SET default_version_id = ? WHERE id = ?`, [versionId, recipeId])

    return cors(json({ versionId }))
}

async function handleSetDefault(req: Request, recipeId: string): Promise<Response> {
    const body = (await req.json()) as { versionId?: string }
    if (!body.versionId) return error("versionId is required")

    const version = db
        .query<{ id: string }, [string, string]>(`SELECT id FROM recipe_versions WHERE id = ? AND recipe_id = ?`)
        .get(body.versionId, recipeId)

    if (!version) return cors(error("Version not found", 404))

    db.run(`UPDATE recipes SET default_version_id = ? WHERE id = ?`, [body.versionId, recipeId])

    return cors(json({ ok: true }))
}

async function handlePrint(recipeId: string): Promise<Response> {
    const recipe = db.query<RecipeRow, [string]>(`SELECT * FROM recipes WHERE id = ?`).get(recipeId)
    if (!recipe) return cors(error("Recipe not found", 404))

    const versionId = recipe.default_version_id
    if (!versionId) return cors(error("No default version set", 400))

    const version = db.query<RecipeVersionRow, [string]>(`SELECT * FROM recipe_versions WHERE id = ?`).get(versionId)
    if (!version) return cors(error("Version not found", 404))

    const parsed = RecipeSchema.safeParse(JSON.parse(version.recipe_json))
    if (!parsed.success) return cors(error("Stored recipe is invalid"))

    try {
        await printRecipe(parsed.data)
        return cors(json({ success: true }))
    } catch (err) {
        return cors(json({ error: err instanceof Error ? err.message : "Print failed" }, 500))
    }
}

function handleDeleteRecipe(id: string): Response {
    const exists = db.query<{ id: string }, [string]>(`SELECT id FROM recipes WHERE id = ?`).get(id)
    if (!exists) return cors(error("Recipe not found", 404))

    db.run(`DELETE FROM recipes WHERE id = ?`, [id])
    return cors(json({ ok: true }))
}

// ─── Router ──────────────────────────────────────────────────────────────────

Bun.serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url)
        const { pathname } = url
        const method = req.method

        if (method === "OPTIONS") {
            return cors(new Response(null, { status: 204 }))
        }

        // Static image serving
        if (method === "GET" && pathname.startsWith("/images/")) {
            const filename = pathname.slice("/images/".length)
            const filePath = path.join(IMAGES_DIR, filename)
            const file = Bun.file(filePath)
            if (!(await file.exists())) return cors(error("Not found", 404))
            return cors(new Response(file))
        }

        // POST /api/recipes/import
        if (method === "POST" && pathname === "/api/recipes/import") {
            return handleImport(req)
        }

        // GET /api/recipes
        if (method === "GET" && pathname === "/api/recipes") {
            return handleListRecipes()
        }

        // GET /api/recipes/:id
        const recipeMatch = pathname.match(/^\/api\/recipes\/([^/]+)$/)
        if (recipeMatch) {
            const id = recipeMatch[1]
            if (method === "GET") return handleGetRecipe(id)
            if (method === "DELETE") return handleDeleteRecipe(id)
        }

        // POST /api/recipes/:id/edit-preview
        const editPreviewMatch = pathname.match(/^\/api\/recipes\/([^/]+)\/edit-preview$/)
        if (editPreviewMatch && method === "POST") {
            return handleEditPreview(req)
        }

        // POST /api/recipes/:id/versions
        const versionsMatch = pathname.match(/^\/api\/recipes\/([^/]+)\/versions$/)
        if (versionsMatch && method === "POST") {
            return handleCommitVersion(req, versionsMatch[1])
        }

        // PATCH /api/recipes/:id/default
        const defaultMatch = pathname.match(/^\/api\/recipes\/([^/]+)\/default$/)
        if (defaultMatch && method === "PATCH") {
            return handleSetDefault(req, defaultMatch[1])
        }

        // POST /api/recipes/:id/print
        const printMatch = pathname.match(/^\/api\/recipes\/([^/]+)\/print$/)
        if (printMatch && method === "POST") {
            return handlePrint(printMatch[1])
        }

        return cors(error("Not found", 404))
    },
})

console.log(`Server running on http://localhost:${PORT}`)
