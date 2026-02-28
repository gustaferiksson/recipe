import { Readability } from "@mozilla/readability"
import { JSDOM } from "jsdom"
import TurndownService from "turndown"

const turndown = new TurndownService({ headingStyle: "atx" })

export interface ScrapeResult {
    markdown: string
    ogImageUrl: string | null
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
    const res = await fetch(url, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    })

    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
    }

    const html = await res.text()
    const dom = new JSDOM(html, { url })

    // Extract og:image before readability strips the head
    const ogImageMeta = dom.window.document.querySelector<HTMLMetaElement>('meta[property="og:image"]')
    const ogImageUrl = ogImageMeta?.content ?? null

    // Use Readability to strip boilerplate
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    if (!article?.content) {
        throw new Error("Could not extract article content from page")
    }

    const markdown = turndown.turndown(article.content)
    return { markdown, ogImageUrl }
}

export async function downloadImage(imageUrl: string, destPath: string, referer: string): Promise<void> {
    const res = await fetch(imageUrl, {
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Referer: referer,
        },
    })
    if (!res.ok) throw new Error(`Image download failed: ${res.status}`)
    const buffer = await res.arrayBuffer()
    await Bun.write(destPath, buffer)
}
