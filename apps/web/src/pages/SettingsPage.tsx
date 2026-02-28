import { ChevronLeft, X } from "lucide-react"
import { useState } from "react"
import { Link, useLoaderData } from "react-router-dom"
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
                <Link to="/" className="btn btn-ghost btn-square">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold">Settings</h1>
            </div>

            <section className="space-y-4">
                <div>
                    <h2 className="text-base font-semibold text-primary">Recipe Tags</h2>
                    <p className="text-sm opacity-60 mt-1">
                        Tags the AI can use when categorising imported or edited recipes.
                    </p>
                </div>

                <form onSubmit={(e) => void handleAdd(e)} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="New tag…"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={adding}
                        className="input input-bordered flex-1 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={adding || !input.trim()}
                        className="btn btn-primary btn-sm self-end"
                    >
                        Add
                    </button>
                </form>

                {error && <p className="text-error text-xs">{error}</p>}

                {tags.length === 0 ? (
                    <p className="text-sm opacity-60">No tags yet.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                            <span key={tag.id} className="badge badge-neutral gap-1 pr-1">
                                {tag.name}
                                <button
                                    type="button"
                                    onClick={() => void handleDelete(tag.id)}
                                    className="rounded-full hover:bg-base-content/20 p-0.5 transition-colors"
                                    aria-label={`Remove tag ${tag.name}`}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
