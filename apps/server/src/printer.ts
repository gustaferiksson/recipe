import type { Recipe } from "@recipe/recipe-core"

// Printer setup — hardware not yet available.
// The formatting logic is implemented and testable via the logged payload.
// Actual USB printing is wired up and will work once an Epson TM is connected.

const COLUMN_WIDTH = 42 // ~80mm at standard font

function wordWrap(text: string, width: number): string[] {
    const words = text.split(" ")
    const lines: string[] = []
    let current = ""

    for (const word of words) {
        if ((current + (current ? " " : "") + word).length > width) {
            if (current) lines.push(current)
            current = word
        } else {
            current = current ? `${current} ${word}` : word
        }
    }

    if (current) lines.push(current)
    return lines
}

function formatIngredient(ing: Recipe["ingredients"][number]): string {
    const parts: string[] = []
    if (ing.quantity != null) parts.push(String(ing.quantity))
    if (ing.unit) parts.push(ing.unit)
    parts.push(ing.name)
    if (ing.preparation) parts.push(`(${ing.preparation})`)
    return parts.join(" ")
}

export interface PrintPayload {
    lines: string[]
}

export function buildPrintPayload(recipe: Recipe): PrintPayload {
    const lines: string[] = []

    const divider = "-".repeat(COLUMN_WIDTH)

    // Title
    lines.push(recipe.title.toUpperCase())
    if (recipe.servings) lines.push(`Serves: ${recipe.servings}`)
    const timeParts: string[] = []
    if (recipe.prepTime) timeParts.push(`Prep ${recipe.prepTime}m`)
    if (recipe.cookTime) timeParts.push(`Cook ${recipe.cookTime}m`)
    if (timeParts.length) lines.push(timeParts.join("  "))
    lines.push(divider)

    // Ingredients
    lines.push("INGREDIENTS")
    for (const ing of recipe.ingredients) {
        lines.push(`  ${formatIngredient(ing)}`)
    }
    lines.push(divider)

    // Steps
    lines.push("STEPS")
    recipe.steps.forEach((step, i) => {
        const wrapped = wordWrap(step, COLUMN_WIDTH - 4)
        wrapped.forEach((line, j) => {
            lines.push(j === 0 ? `${i + 1}. ${line}` : `   ${line}`)
        })
    })
    lines.push(divider)

    return { lines }
}

export async function printRecipe(recipe: Recipe): Promise<void> {
    const payload = buildPrintPayload(recipe)
    console.log(`[printer] payload:\n${payload.lines.join("\n")}`)

    // Dynamic import so the server starts even if node-thermal-printer has issues
    // in a non-USB environment.
    const { ThermalPrinter, PrinterTypes, CharacterSet } = await import("node-thermal-printer")

    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: process.env.PRINTER_INTERFACE ?? "usb",
        characterSet: CharacterSet.PC437_USA,
        removeSpecialCharacters: false,
        width: 48,
    })

    const isConnected = await printer.isPrinterConnected()
    if (!isConnected) {
        throw new Error("Printer is not connected")
    }

    printer.alignCenter()
    printer.bold(true)
    printer.println(recipe.title.toUpperCase())
    printer.bold(false)

    if (recipe.servings) printer.println(`Serves: ${recipe.servings}`)

    const timeParts: string[] = []
    if (recipe.prepTime) timeParts.push(`Prep ${recipe.prepTime}m`)
    if (recipe.cookTime) timeParts.push(`Cook ${recipe.cookTime}m`)
    if (timeParts.length) printer.println(timeParts.join("  "))

    printer.drawLine()
    printer.alignLeft()
    printer.bold(true)
    printer.println("INGREDIENTS")
    printer.bold(false)

    for (const ing of recipe.ingredients) {
        printer.println(`  ${formatIngredient(ing)}`)
    }

    printer.drawLine()
    printer.bold(true)
    printer.println("STEPS")
    printer.bold(false)

    recipe.steps.forEach((step, i) => {
        const wrapped = wordWrap(step, COLUMN_WIDTH - 4)
        wrapped.forEach((line, j) => {
            printer.println(j === 0 ? `${i + 1}. ${line}` : `   ${line}`)
        })
    })

    printer.drawLine()
    printer.cut()

    await printer.execute()
}
