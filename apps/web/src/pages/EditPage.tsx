import type { RecipeDetail } from "@recipe/recipe-core"
import { Check, ChevronLeft, Loader2 } from "lucide-react"
import { useState } from "react"
import { Link, type LoaderFunctionArgs, useLoaderData, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { commitVersion, editPreview, getRecipe } from "../api"

export async function loader({ params }: LoaderFunctionArgs) {
    return getRecipe(params.id ?? "")
}

function RecipePane({
    recipe,
    label,
}: {
    recipe: NonNullable<RecipeDetail["versions"][number]["recipe"]>
    label: string
}) {
    return (
        <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{label}</p>
            <div className="bg-card rounded-[--radius] border border-border p-4 space-y-4 text-sm h-full overflow-y-auto">
                <div>
                    <p className="font-bold text-base leading-tight">{recipe.title}</p>
                    <div className="flex flex-wrap gap-2 mt-1 text-muted-foreground text-xs">
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

    // The "base" for the next diff is the latest proposed, or the current saved version
    const diffBase = proposed ?? current

    async function handleGenerate() {
        if (!prompt.trim() || !diffBase || !id) return

        setGenerating(true)
        setError("")
        try {
            const result = await editPreview(id, prompt.trim(), diffBase)
            setProposed(result)
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
            await commitVersion(id, proposed, prompt || "AI edit")
            void navigate(`/recipes/${id}`)
        } catch {
            setError("Failed to save version")
            setCommitting(false)
        }
    }

    if (!current) {
        return (
            <div className="min-h-dvh flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Recipe not found.</p>
            </div>
        )
    }

    return (
        <div className="min-h-dvh flex flex-col max-w-2xl mx-auto">
            {/* Top bar */}
            <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link to={`/recipes/${id}`}>
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                </Button>
                <span className="flex-1 font-semibold text-sm truncate">Edit — {current.title}</span>
                {proposed && (
                    <Button size="sm" onClick={() => void handleAccept()} disabled={committing}>
                        {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Accept
                    </Button>
                )}
            </div>

            {/* Diff area */}
            <div className="flex gap-3 px-4 pt-4 flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                <RecipePane recipe={current} label="Current" />
                {proposed && <RecipePane recipe={proposed} label="Proposed" />}
            </div>

            {/* Prompt bar */}
            <div className="sticky bottom-0 bg-background/90 backdrop-blur border-t border-border px-4 py-4 space-y-2">
                {error && <p className="text-destructive text-xs">{error}</p>}
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        void handleGenerate()
                    }}
                    className="flex gap-2"
                >
                    <Textarea
                        placeholder={
                            proposed
                                ? "Refine further… (e.g. also scale to 4 servings)"
                                : "Describe your change… (e.g. make it vegetarian)"
                        }
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={generating}
                        className="resize-none min-h-13 max-h-30 text-sm"
                        rows={2}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                void handleGenerate()
                            }
                        }}
                    />
                    <Button type="submit" disabled={generating || !prompt.trim()} className="self-end shrink-0">
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                    </Button>
                </form>
                <p className="text-xs text-muted-foreground">Enter to apply · Shift+Enter for new line</p>
            </div>
        </div>
    )
}
