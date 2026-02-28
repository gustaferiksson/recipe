import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const serverPort = process.env.SERVER_PORT ?? "3001"

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        proxy: {
            "/api": `http://localhost:${serverPort}`,
            "/images": `http://localhost:${serverPort}`,
        },
    },
})
