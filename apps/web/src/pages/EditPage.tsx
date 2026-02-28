import type { RecipeDetail } from "@recipe/recipe-core"
import { Check, ChevronLeft, Loader2 } from "lucide-react"
import { useState } from "react"
import { Link, type LoaderFunctionArgs, useLoaderData, useNavigate, useParams } from "react-router-dom"
import { commitVersion, editPreview, getRecipe } from "../api"

export async function loader({ params }: LoaderFunctionArgs) {
    return getRecipe(params.id ?? "")
}

function RecipePane({
    recipe,
}: {
    recipe: NonNullable<RecipeDetail["versions"][number]["recipe"]>
}) {
    return (
        <div className="bg-base-200 rounded-box border border-base-300 p-4 space-y-4 text-sm overflow-y-auto">
            <div>
                <p className="font-bold text-base leading-tight">{recipe.title}</p>
                <div className="flex flex-wrap gap-2 mt-1 opacity-60 text-xs">
                    {recipe.servings && <span>Serves {recipe.servings}</span>}
                    {recipe.prepTime && <span>Prep {recipe.prepTime}m</span>}
                    {recipe.cookTime && <span>Cook {recipe.cookTime}m</span>}
                </div>
            </div>

            <div>
                <p className="font-semibold text-primary mb-1.5">Ingredients</p>
                <ul className="space-y-1">
                    {recipe.ingredients.map((ing) => (
                        <li key={ing.name} className="text-xs">
                            {[
                                ing.quantity != null ? String(ing.quantity) : null,
                                ing.unit,
                                ing.name,
                                ing.preparation ? `(${ing.preparation})` : null,
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        </li>
                    ))}
                </ul>
            </div>

            <div>
                <p className="font-semibold text-primary mb-1.5">Steps</p>
                <ol className="space-y-2">
                    {recipe.steps.map((step, i) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: steps are ordered and immutable within a render
                        <li key={i} className="text-xs flex gap-2">
                            <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                            <span className="leading-relaxed">{step}</span>
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    )
}

export function EditPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const detail = useLoaderData() as Awaited<ReturnType<typeof loader>>

    const current = (detail.versions.find((v) => v.id === detail.defaultVersionId) ?? detail.versions.at(-1))?.recipe

    const [prompt, setPrompt] = useState("")
    const [proposed, setProposed] = useState<NonNullable<typeof current> | null>(null)
    const [generating, setGenerating] = useState(false)
    const [committing, setCommitting] = useState(false)
    const [error, setError] = useState("")
    const [activeTab, setActiveTab] = useState<"original" | "edited">("edited")

    const diffBase = proposed ?? current

    async function handleGenerate() {
        if (!prompt.trim() || !diffBase || !id) return

        setGenerating(true)
        setError("")
        try {
            const result = await editPreview(id, prompt.trim(), diffBase)
            setProposed(result)
            setActiveTab("edited")
            setPrompt("")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Something went wrong")
        } finally {
            setGenerating(false)
        }
    }

    async function handleAccept() {
        if (!proposed || !id) return
        setCommitting(true)
        try {
            await commitVersion(id, proposed, "AI edit")
            void navigate(`/recipes/${id}`)
        } catch {
            setError("Failed to save version")
            setCommitting(false)
        }
    }

    if (!current) {
        return (
            <div className="min-h-dvh flex items-center justify-center">
                <p className="text-sm opacity-60">Recipe not found.</p>
            </div>
        )
    }

    return (
        <div className="min-h-dvh flex flex-col max-w-lg mx-auto">
            {/* Top bar */}
            <div className="sticky top-0 z-10 bg-base-100/90 backdrop-blur border-b border-base-300 px-4 py-3 flex items-center gap-2">
                <Link to={`/recipes/${id}`} className="btn btn-ghost btn-square">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <span className="flex-1 font-semibold text-sm truncate">Edit — {current.title}</span>
                {proposed && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleAccept()} disabled={committing}>
                        {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Accept
                    </button>
                )}
            </div>

            {/* Recipe pane / tabs */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
                {proposed ? (
                    <>
                        <div role="tablist" className="tabs tabs-lifted mb-4">
                            <button
                                role="tab"
                                type="button"
                                className={`tab ${activeTab === "original" ? "tab-active" : ""}`}
                                onClick={() => setActiveTab("original")}
                            >
                                Original
                            </button>
                            <button
                                role="tab"
                                type="button"
                                className={`tab ${activeTab === "edited" ? "tab-active" : ""}`}
                                onClick={() => setActiveTab("edited")}
                            >
                                Edited
                            </button>
                        </div>
                        {activeTab === "original" && <RecipePane recipe={current} />}
                        {activeTab === "edited" && <RecipePane recipe={proposed} />}
                    </>
                ) : (
                    <RecipePane recipe={current} />
                )}
            </div>

            {/* Prompt bar */}
            <div className="sticky bottom-0 bg-base-100/90 backdrop-blur border-t border-base-300 px-4 py-4 space-y-2">
                {error && <p className="text-error text-xs">{error}</p>}
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        void handleGenerate()
                    }}
                    className="flex gap-2"
                >
                    <textarea
                        placeholder={
                            proposed
                                ? "Refine further… (e.g. also scale to 4 servings)"
                                : "Describe your change… (e.g. make it vegetarian)"
                        }
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={generating}
                        className="textarea textarea-bordered flex-1 resize-none text-sm"
                        rows={2}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                void handleGenerate()
                            }
                        }}
                    />
                    <button type="submit" disabled={generating || !prompt.trim()} className="btn btn-primary self-end shrink-0">
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                    </button>
                </form>
                <p className="text-xs opacity-50">Enter to apply · Shift+Enter for new line</p>
            </div>
        </div>
    )
}
