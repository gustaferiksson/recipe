import fs from "node:fs"
import path from "node:path"

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data")
const DB_PATH = path.join(DATA_DIR, "recipes.db")
const IMAGES_DIR = path.join(DATA_DIR, "images")

console.log("Resetting database and data...")

// Remove database file
if (fs.existsSync(DB_PATH)) {
    fs.rmSync(DB_PATH)
    console.log(`Deleted ${DB_PATH}`)
} else {
    console.log("No database file found, skipping")
}

// Also clean up WAL/SHM sidecar files if present
for (const ext of ["-wal", "-shm"]) {
    const sideCar = DB_PATH + ext
    if (fs.existsSync(sideCar)) {
        fs.rmSync(sideCar)
        console.log(`Deleted ${sideCar}`)
    }
}

// Clear images directory
if (fs.existsSync(IMAGES_DIR)) {
    const files = fs.readdirSync(IMAGES_DIR)
    for (const file of files) {
        fs.rmSync(path.join(IMAGES_DIR, file))
    }
    console.log(`Cleared ${files.length} file(s) from ${IMAGES_DIR}`)
} else {
    console.log("No images directory found, skipping")
}

console.log("Done.")
