import type { IngredientDiff, RecipeDetail } from "@recipe/recipe-core"
import { Check, ChevronLeft, Eye, Pencil, Printer, Star } from "lucide-react"
import { useState } from "react"
import { Link, type LoaderFunctionArgs, useLoaderData, useNavigate, useParams, useSearchParams } from "react-router-dom"
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
        <ul className="mt-1.5 space-y-0.5 text-xs opacity-70">
            {changeset.map((diff, i) => {
                if (diff.type === "added") {
                    return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: diffs have no stable id
                        <li key={i} className="text-success">
                            ➕ {diff.ingredient.name}
                        </li>
                    )
                }
                if (diff.type === "removed") {
                    return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: diffs have no stable id
                        <li key={i} className="text-error">
                            ➖ {diff.ingredient.name}
                        </li>
                    )
                }
                return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: diffs have no stable id
                    <li key={i} className="text-warning">
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
    const [searchParams, setSearchParams] = useSearchParams()
    const [printing, setPrinting] = useState(false)
    const [printMsg, setPrintMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

    const viewingId = searchParams.get("version") ?? detail.defaultVersionId
    const activeVersion = detail.versions.find((v) => v.id === viewingId) ?? detail.versions[0]
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
                <p className="text-sm opacity-60">Recipe not found.</p>
            </div>
        )
    }

    const imageSrc = detail.imagePath ? `/images/${detail.imagePath}` : null

    return (
        <div className="min-h-dvh max-w-lg mx-auto pb-10">
            {/* Top bar */}
            <div className="sticky top-0 z-10 bg-base-100/90 backdrop-blur border-b border-base-300 px-4 py-3 flex items-center gap-2">
                <Link to="/recipes" className="btn btn-ghost btn-square">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <span className="flex-1 font-semibold truncate text-sm">{recipe.title}</span>
                <button
                    type="button"
                    className="btn btn-ghost btn-square"
                    onClick={() => void navigate(`/recipes/${id}/edit`)}
                >
                    <Pencil className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    className="btn btn-primary btn-square"
                    onClick={handlePrint}
                    disabled={printing}
                    title="Print recipe"
                >
                    <Printer className="w-4 h-4" />
                </button>
            </div>

            {/* Print feedback */}
            {printMsg && (
                <div
                    role="alert"
                    className={`alert ${printMsg.type === "success" ? "alert-success" : "alert-error"} mx-4 mt-3`}
                >
                    {printMsg.type === "success" && <Check className="w-4 h-4" />}
                    <span>{printMsg.text}</span>
                </div>
            )}

            {/* Hero image */}
            <div className="mt-4 px-4">
                {imageSrc ? (
                    <img src={imageSrc} alt={recipe.title} className="w-full aspect-video object-cover rounded-lg" />
                ) : (
                    <div className="w-full aspect-video bg-base-200 flex items-center justify-center rounded-lg">
                        <span className="text-6xl opacity-30">🍳</span>
                    </div>
                )}
            </div>

            <div className="px-5 pt-5 space-y-6">
                {/* Title + meta */}
                <div>
                    <h1 className="text-2xl font-bold leading-tight">{recipe.title}</h1>
                    <div className="flex flex-wrap gap-3 mt-2 text-sm opacity-60">
                        {recipe.servings && <span>Serves {recipe.servings}</span>}
                        {recipe.prepTime && <span>Prep {recipe.prepTime}m</span>}
                        {recipe.cookTime && <span>Cook {recipe.cookTime}m</span>}
                        {recipe.cuisine && <span>{recipe.cuisine}</span>}
                    </div>
                    {recipe.tags && recipe.tags.length > 0 && (
                        <div className="flex gap-2 mt-3 flex-wrap">
                            {recipe.tags.map((t) => (
                                <span key={t} className="badge badge-neutral">
                                    {t}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Ingredients */}
                <section>
                    <h2 className="text-base font-semibold mb-3">Ingredients</h2>
                    <ul className="space-y-2">
                        {recipe.ingredients.map((ing) => (
                            <li key={ing.name} className="text-sm">
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
                </section>

                {/* Steps */}
                <section>
                    <h2 className="text-base font-semibold mb-3">Steps</h2>
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
                        <h2 className="text-base font-semibold mb-3">Versions</h2>
                        <ul className="space-y-2">
                            {detail.versions.map((v) => {
                                const isDefault = v.id === detail.defaultVersionId
                                const isViewing = v.id === viewingId
                                const isViewingNonDefault = isViewing && !isDefault
                                const label = v.name ?? v.editPrompt ?? "Original"
                                return (
                                    <li
                                        key={v.id}
                                        className={`flex items-stretch rounded-box border text-sm transition-colors ${
                                            isDefault
                                                ? "border-primary/40 bg-primary/5"
                                                : isViewing
                                                  ? "border-base-300 bg-base-200"
                                                  : "border-base-300 hover:border-primary/20"
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            className="flex-1 text-left p-3 min-w-0 cursor-pointer"
                                            onClick={() =>
                                                setSearchParams(
                                                    { version: v.id },
                                                    { replace: true, preventScrollReset: true }
                                                )
                                            }
                                        >
                                            <p className="font-medium truncate">{label}</p>
                                            <p className="text-xs opacity-50 mt-0.5">
                                                {new Date(v.createdAt).toLocaleDateString()}
                                            </p>
                                            {v.changeset && v.changeset.length > 0 && (
                                                <ChangesetDisplay changeset={v.changeset} />
                                            )}
                                        </button>
                                        <div className="flex items-center px-3 shrink-0">
                                            {isViewingNonDefault && (
                                                <span className="flex items-center gap-1 text-xs opacity-60">
                                                    <Eye className="w-3 h-3" /> Viewing
                                                </span>
                                            )}
                                            {isDefault ? (
                                                <span className="flex items-center gap-1 text-xs text-primary font-medium">
                                                    <Star className="w-3 h-3" /> Default
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-xs opacity-60"
                                                    onClick={() => void handleSetDefault(v.id)}
                                                >
                                                    Set default
                                                </button>
                                            )}
                                        </div>
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
                    className="link link-hover text-xs opacity-50 block"
                >
                    View original source ↗
                </a>
            </div>
        </div>
    )
}
