import { Loader2 } from "lucide-react"
import { useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
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
                    <span className="text-2xl">🍳</span>
                    <h1 className="text-2xl font-bold text-primary">Recipes</h1>
                </div>
                <Link to="/recipes" className="link link-hover text-sm">
                    My Recipes →
                </Link>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <label htmlFor="url" className="label">
                    Paste a recipe URL
                </label>
                <input
                    id="url"
                    type="url"
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isLoading}
                    inputMode="url"
                    className="input input-bordered w-full text-base"
                />
                <button type="submit" disabled={isLoading || !url.trim()} className="btn btn-primary btn-lg">
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Import Recipe
                </button>
            </form>

            {isLoading && (
                <div className="mt-10 flex flex-col items-center gap-3 opacity-60">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm">{statusLabel[phase as "scraping" | "parsing"]}</p>
                </div>
            )}

            {phase === "error" && (
                <div role="alert" className="alert alert-error mt-8 flex flex-col items-start gap-3">
                    <p>{errorMsg}</p>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setPhase("idle")}>
                        Try again
                    </button>
                </div>
            )}
        </div>
    )
}
