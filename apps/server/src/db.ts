import { Database } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data")
const DB_PATH = path.join(DATA_DIR, "recipes.db")

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(path.join(DATA_DIR, "images"), { recursive: true })

export const db = new Database(DB_PATH)

db.run(`PRAGMA journal_mode = WAL`)
db.run(`PRAGMA foreign_keys = ON`)

db.run(`
  CREATE TABLE IF NOT EXISTS recipes (
    id                 TEXT PRIMARY KEY,
    source_url         TEXT NOT NULL,
    scraped_at         TEXT NOT NULL,
    original_json      TEXT NOT NULL,
    default_version_id TEXT REFERENCES recipe_versions(id),
    image_path         TEXT,
    created_at         TEXT NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS recipe_versions (
    id          TEXT PRIMARY KEY,
    recipe_id   TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    recipe_json TEXT NOT NULL,
    edit_prompt TEXT,
    name        TEXT,
    changeset   TEXT,
    created_at  TEXT NOT NULL
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS tags (
    id         TEXT PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
  )
`)

export const IMAGES_DIR = path.join(DATA_DIR, "images")
