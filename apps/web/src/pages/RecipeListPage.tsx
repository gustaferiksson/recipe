import type { RecipeListItem } from "@recipe/recipe-core"
import { ChevronLeft, Settings, Trash2, UtensilsCrossed } from "lucide-react"
import { useState } from "react"
import { Link, useLoaderData, useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
                <Button variant="ghost" size="icon" asChild>
                    <Link to="/">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                </Button>
                <h1 className="text-xl font-bold flex-1">My Recipes</h1>
                <Button variant="ghost" size="icon" asChild className="text-muted-foreground">
                    <Link to="/settings" aria-label="Settings">
                        <Settings className="w-4 h-4" />
                    </Link>
                </Button>
            </div>

            {recipes.length === 0 && (
                <div className="flex flex-col items-center gap-4 mt-20 text-muted-foreground">
                    <UtensilsCrossed className="w-10 h-10" />
                    <p className="text-sm">No recipes yet.</p>
                    <Button onClick={() => void navigate("/")}>Import one</Button>
                </div>
            )}

            <ul className="flex flex-col gap-3">
                {recipes.map((r) => (
                    <li
                        key={r.id}
                        className="flex items-center bg-card rounded-[--radius-lg] border border-border hover:border-primary/40 transition-colors"
                    >
                        <button
                            type="button"
                            className="flex items-center gap-3 flex-1 min-w-0 p-4 text-left active:scale-[0.99]"
                            onClick={() => void navigate(`/recipes/${r.id}`)}
                        >
                            {r.imagePath ? (
                                <img
                                    className="w-14 h-14 rounded-[--radius-sm] object-cover shrink-0"
                                    src={`/images/${r.imagePath}`}
                                    alt={r.title}
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-[--radius-sm] bg-muted flex items-center justify-center shrink-0">
                                    <UtensilsCrossed className="w-6 h-6 text-muted-foreground/50" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{r.title}</p>
                                <div className="flex gap-2 mt-1 flex-wrap">
                                    {r.cuisine && (
                                        <Badge variant="secondary" className="text-xs">
                                            {r.cuisine}
                                        </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                        {r.versionCount} version{r.versionCount !== 1 ? "s" : ""}
                                    </span>
                                </div>
                            </div>
                        </button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive shrink-0 mr-2"
                            onClick={(e) => void handleDelete(e, r.id)}
                            aria-label="Delete recipe"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
