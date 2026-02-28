import type { IngredientDiff, RecipeDetail } from "@recipe/recipe-core"
import { Check, ChevronLeft, Eye, Pencil, Printer, Star, UtensilsCrossed } from "lucide-react"
import { useState } from "react"
import { Link, type LoaderFunctionArgs, useLoaderData, useNavigate, useParams } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getRecipe, printRecipe, setDefault } from "../api"

export async function loader({ params }: LoaderFunctionArgs) {
    return getRecipe(params.id ?? "")
}

function formatIngredientShort(ing: { quantity?: number | null; unit?: string | null; name: string }): string {
    return [ing.quantity != null ? String(ing.quantity) : null, ing.unit, ing.name].filter(Boolean).join(" ")
}

function ChangesetDisplay({ changeset }: { changeset: IngredientDiff[] }) {
    if (changeset.length === 0) return null
    return (
        <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
            {changeset.map((diff, i) => {
                if (diff.type === "added") {
                    return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: diffs have no stable id
                        <li key={i} className="text-green-600 dark:text-green-400">
                            ➕ {diff.ingredient.name}
                        </li>
                    )
                }
                if (diff.type === "removed") {
                    return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: diffs have no stable id
                        <li key={i} className="text-red-500 dark:text-red-400">
                            ➖ {diff.ingredient.name}
                        </li>
                    )
                }
                return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: diffs have no stable id
                    <li key={i} className="text-amber-600 dark:text-amber-400">
                        ✏️ {diff.before.name}: {formatIngredientShort(diff.before)} → {formatIngredientShort(diff.after)}
                    </li>
                )
            })}
        </ul>
    )
}

export function RecipeDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const loaded = useLoaderData() as Awaited<ReturnType<typeof loader>>
    const [detail, setDetail] = useState<RecipeDetail>(loaded)
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
    const [printing, setPrinting] = useState(false)
    const [printMsg, setPrintMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

    const viewingId = selectedVersionId ?? detail.defaultVersionId
    const activeVersion =
        detail.versions.find((v) => v.id === viewingId) ?? detail.versions[0]
    const recipe = activeVersion?.recipe

    async function handleSetDefault(versionId: string) {
        if (!id) return
        await setDefault(id, versionId)
        setDetail({ ...detail, defaultVersionId: versionId })
    }

    async function handlePrint() {
        if (!id) return
        setPrinting(true)
        setPrintMsg(null)
        try {
            await printRecipe(id)
            setPrintMsg({ type: "success", text: "Sent to printer!" })
            setTimeout(() => setPrintMsg(null), 3000)
        } catch (err) {
            setPrintMsg({
                type: "error",
                text: err instanceof Error ? err.message : "Print failed",
            })
        } finally {
            setPrinting(false)
        }
    }

    if (!recipe) {
        return (
            <div className="min-h-dvh flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Recipe not found.</p>
            </div>
        )
    }

    const imageSrc = detail.imagePath ? `/images/${detail.imagePath}` : null

    return (
        <div className="min-h-dvh max-w-lg mx-auto pb-10">
            {/* Top bar */}
            <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link to="/recipes">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                </Button>
                <span className="flex-1 font-semibold truncate text-sm">{recipe.title}</span>
                <Button variant="ghost" size="icon" onClick={() => void navigate(`/recipes/${id}/edit`)}>
                    <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" onClick={handlePrint} disabled={printing} title="Print recipe">
                    <Printer className="w-4 h-4" />
                </Button>
            </div>

            {/* Print feedback */}
            {printMsg && (
                <div
                    className={`mx-4 mt-3 px-4 py-2 rounded-[--radius] text-sm flex items-center gap-2 ${
                        printMsg.type === "success"
                            ? "bg-primary/15 text-primary"
                            : "bg-destructive/15 text-destructive"
                    }`}
                >
                    {printMsg.type === "success" && <Check className="w-4 h-4" />}
                    {printMsg.text}
                </div>
            )}

            {/* Hero image */}
            {imageSrc ? (
                <img src={imageSrc} alt={recipe.title} className="w-full aspect-video object-cover rounded-lg" />
            ) : (
                <div className="w-full aspect-video bg-muted flex items-center justify-center rounded-lg">
                    <UtensilsCrossed className="w-12 h-12 text-muted-foreground/30" />
                </div>
            )}

            <div className="px-5 pt-5 space-y-6">
                {/* Title + meta */}
                <div>
                    <h1 className="text-2xl font-bold leading-tight">{recipe.title}</h1>
                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                        {recipe.servings && <span>Serves {recipe.servings}</span>}
                        {recipe.prepTime && <span>Prep {recipe.prepTime}m</span>}
                        {recipe.cookTime && <span>Cook {recipe.cookTime}m</span>}
                        {recipe.cuisine && <span>{recipe.cuisine}</span>}
                    </div>
                    {recipe.tags && recipe.tags.length > 0 && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                            {recipe.tags.map((t) => (
                                <Badge key={t} variant="secondary">
                                    {t}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>

                {/* Ingredients */}
                <section>
                    <h2 className="text-base font-semibold mb-3 text-primary">Ingredients</h2>
                    <ul className="space-y-2">
                        {recipe.ingredients.map((ing, i) => (
                            <li key={ing.name} className="flex gap-2 text-sm">
                                <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                                <span>
                                    {[
                                        ing.quantity != null ? String(ing.quantity) : null,
                                        ing.unit,
                                        ing.name,
                                        ing.preparation ? `(${ing.preparation})` : null,
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Steps */}
                <section>
                    <h2 className="text-base font-semibold mb-3 text-primary">Steps</h2>
                    <ol className="space-y-4">
                        {recipe.steps.map((step, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: steps are ordered and have no stable id
                            <li key={i} className="flex gap-3 text-sm">
                                <span className="text-primary font-bold shrink-0 w-5 text-right">{i + 1}</span>
                                <span className="leading-relaxed">{step}</span>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* Version history */}
                {detail.versions.length > 1 && (
                    <section>
                        <h2 className="text-base font-semibold mb-3 text-primary">Versions</h2>
                        <ul className="space-y-2">
                            {detail.versions.map((v) => {
                                const isDefault = v.id === detail.defaultVersionId
                                const isViewing = v.id === viewingId
                                const isViewingNonDefault = isViewing && !isDefault
                                const label = v.name ?? v.editPrompt ?? "Original"
                                return (
                                    <li
                                        key={v.id}
                                        className={`p-3 rounded-[--radius] border text-sm transition-colors cursor-pointer ${
                                            isDefault
                                                ? "border-primary/40 bg-primary/5"
                                                : isViewing
                                                  ? "border-primary/20 bg-muted/50"
                                                  : "border-border hover:border-primary/20"
                                        }`}
                                        onClick={() => setSelectedVersionId(v.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{label}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {new Date(v.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {isViewingNonDefault && (
                                                    <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                                        <Eye className="w-3 h-3" /> Viewing
                                                    </span>
                                                )}
                                                {isDefault ? (
                                                    <span className="flex items-center gap-1 text-xs text-primary font-medium">
                                                        <Star className="w-3 h-3" /> Default
                                                    </span>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            void handleSetDefault(v.id)
                                                        }}
                                                        className="text-xs text-muted-foreground"
                                                    >
                                                        Set default
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        {v.changeset && v.changeset.length > 0 && (
                                            <ChangesetDisplay changeset={v.changeset} />
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                )}

                <a
                    href={recipe.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors block"
                >
                    View original source ↗
                </a>
            </div>
        </div>
    )
}
