import type { RecipeListItem } from "@recipe/recipe-core"
import { ChevronLeft, Settings, Trash2 } from "lucide-react"
import { useState } from "react"
import { Link, useLoaderData, useNavigate } from "react-router-dom"
import { deleteRecipe, listRecipes } from "../api"

export async function loader() {
    return listRecipes()
}

export function RecipeListPage() {
    const loaded = useLoaderData() as Awaited<ReturnType<typeof loader>>
    const [recipes, setRecipes] = useState<RecipeListItem[]>(loaded)
    const navigate = useNavigate()

    async function handleDelete(e: React.MouseEvent, id: string) {
        e.stopPropagation()
        if (!confirm("Delete this recipe?")) return
        await deleteRecipe(id)
        setRecipes((prev) => prev.filter((r) => r.id !== id))
    }

    return (
        <div className="min-h-dvh flex flex-col px-4 py-6 max-w-lg mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <Link to="/" className="btn btn-ghost btn-square">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold flex-1">My Recipes</h1>
                <Link to="/settings" className="btn btn-ghost btn-square" aria-label="Settings">
                    <Settings className="w-4 h-4" />
                </Link>
            </div>

            {recipes.length === 0 && (
                <div className="flex flex-col items-center gap-4 mt-20 opacity-60">
                    <span className="text-5xl">🍳</span>
                    <p className="text-sm">No recipes yet.</p>
                    <button type="button" className="btn btn-primary" onClick={() => void navigate("/")}>
                        Import one
                    </button>
                </div>
            )}

            <ul className="flex flex-col gap-3">
                {recipes.map((r) => (
                    <li key={r.id} className="card card-border bg-base-100 hover:border-primary/40 transition-colors">
                        <div className="flex items-center">
                            <button
                                type="button"
                                className="flex items-center gap-3 flex-1 min-w-0 p-4 text-left active:scale-[0.99]"
                                onClick={() => void navigate(`/recipes/${r.id}`)}
                            >
                                {r.imagePath ? (
                                    <img
                                        className="w-14 h-14 rounded-lg object-cover shrink-0"
                                        src={`/images/${r.imagePath}`}
                                        alt={r.title}
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded-lg bg-base-200 flex items-center justify-center shrink-0">
                                        <span className="text-2xl">🍳</span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">{r.title}</p>
                                    <div className="flex gap-2 mt-1 flex-wrap items-center">
                                        {r.cuisine && <span className="badge badge-neutral text-xs">{r.cuisine}</span>}
                                        <span className="text-xs opacity-60">
                                            {r.versionCount} version{r.versionCount !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                </div>
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost btn-square text-base-content/40 hover:text-error shrink-0 mr-2"
                                onClick={(e) => void handleDelete(e, r.id)}
                                aria-label="Delete recipe"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
}
