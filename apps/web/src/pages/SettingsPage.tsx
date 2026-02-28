import { ChevronLeft, X } from "lucide-react"
import { useState } from "react"
import { Link, useLoaderData } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createTag, deleteTag, getTags } from "../api"

export async function loader() {
    return getTags()
}

export function SettingsPage() {
    const loaded = useLoaderData() as Awaited<ReturnType<typeof loader>>
    const [tags, setTags] = useState(loaded)
    const [input, setInput] = useState("")
    const [adding, setAdding] = useState(false)
    const [error, setError] = useState("")

    async function handleAdd(e: React.FormEvent) {
        e.preventDefault()
        const name = input.trim()
        if (!name) return

        setAdding(true)
        setError("")
        try {
            const tag = await createTag(name)
            setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
            setInput("")
        } catch {
            setError("Failed to add tag (it may already exist)")
        } finally {
            setAdding(false)
        }
    }

    async function handleDelete(id: string) {
        try {
            await deleteTag(id)
            setTags((prev) => prev.filter((t) => t.id !== id))
        } catch {
            setError("Failed to delete tag")
        }
    }

    return (
        <div className="min-h-dvh flex flex-col px-4 py-6 max-w-lg mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <Button variant="ghost" size="icon" asChild>
                    <Link to="/">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                </Button>
                <h1 className="text-xl font-bold">Settings</h1>
            </div>

            <section className="space-y-4">
                <div>
                    <h2 className="text-base font-semibold text-primary">Recipe Tags</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Tags the AI can use when categorising imported or edited recipes.
                    </p>
                </div>

                <form onSubmit={(e) => void handleAdd(e)} className="flex gap-2">
                    <Input
                        placeholder="New tag…"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={adding}
                        className="text-sm"
                    />
                    <Button type="submit" disabled={adding || !input.trim()} size="sm" className="shrink-0">
                        Add
                    </Button>
                </form>

                {error && <p className="text-destructive text-xs">{error}</p>}

                {tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tags yet.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                            <Badge key={tag.id} variant="secondary" className="flex items-center gap-1 pr-1">
                                {tag.name}
                                <button
                                    type="button"
                                    onClick={() => void handleDelete(tag.id)}
                                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5 transition-colors"
                                    aria-label={`Remove tag ${tag.name}`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
