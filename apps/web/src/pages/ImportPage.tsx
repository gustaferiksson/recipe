import { Loader2, Settings, UtensilsCrossed } from "lucide-react"
import { useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { type ImportEvent, importRecipe } from "../api"

type Phase = "idle" | "scraping" | "parsing" | "error"

const statusLabel: Record<"scraping" | "parsing", string> = {
    scraping: "Scraping page…",
    parsing: "Parsing recipe…",
}

export function ImportPage() {
    const [url, setUrl] = useState("")
    const [phase, setPhase] = useState<Phase>("idle")
    const [errorMsg, setErrorMsg] = useState("")
    const navigate = useNavigate()
    const cancelRef = useRef<(() => void) | null>(null)

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!url.trim()) return

        setPhase("scraping")
        setErrorMsg("")

        cancelRef.current = importRecipe(url.trim(), (event: ImportEvent) => {
            if (event.status === "scraping") setPhase("scraping")
            else if (event.status === "parsing") setPhase("parsing")
            else if (event.status === "done") {
                void navigate(`/recipes/${event.recipeId}`)
            } else if (event.status === "error") {
                setPhase("error")
                setErrorMsg(event.message)
            }
        })
    }

    const isLoading = phase === "scraping" || phase === "parsing"

    return (
        <div className="min-h-dvh flex flex-col px-6 py-8 max-w-lg mx-auto">
            <div className="flex items-baseline justify-between mb-12">
                <div className="flex items-center gap-2">
                    <UtensilsCrossed className="text-primary w-5 h-5" />
                    <h1 className="text-2xl font-bold text-primary">Recipe Printer</h1>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/recipes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        My Recipes →
                    </Link>
                    <Button variant="ghost" size="icon" asChild className="text-muted-foreground">
                        <Link to="/settings" aria-label="Settings">
                            <Settings className="w-4 h-4" />
                        </Link>
                    </Button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label htmlFor="url" className="text-sm text-muted-foreground">
                    Paste a recipe URL
                </label>
                <Input
                    id="url"
                    type="url"
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    inputMode="url"
                    className="text-base"
                />
                <Button type="submit" disabled={isLoading || !url.trim()} size="lg">
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Import Recipe
                </Button>
            </form>

            {isLoading && (
                <div className="mt-10 flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm">{statusLabel[phase as "scraping" | "parsing"]}</p>
                </div>
            )}

            {phase === "error" && (
                <div className="mt-8 p-4 rounded-[--radius] border border-destructive/40 bg-destructive/10 text-destructive text-sm flex flex-col gap-3">
                    <p>{errorMsg}</p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="self-start border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => setPhase("idle")}
                    >
                        Try again
                    </Button>
                </div>
            )}
        </div>
    )
}
