import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom"
import { EditPage, loader as editLoader } from "./pages/EditPage"
import { ImportPage } from "./pages/ImportPage"
import { loader as detailLoader, RecipeDetailPage } from "./pages/RecipeDetailPage"
import { RecipeListPage, loader as recipesLoader } from "./pages/RecipeListPage"
import { SettingsPage, loader as settingsLoader } from "./pages/SettingsPage"
import "./index.css"

const router = createBrowserRouter([
    {
        path: "/",
        element: <ImportPage />,
    },
    {
        path: "/recipes",
        loader: recipesLoader,
        element: <RecipeListPage />,
    },
    {
        path: "/recipes/:id",
        loader: detailLoader,
        shouldRevalidate: ({ currentUrl, nextUrl }) => currentUrl.pathname !== nextUrl.pathname,
        element: <RecipeDetailPage />,
    },
    {
        path: "/recipes/:id/edit",
        loader: editLoader,
        element: <EditPage />,
    },
    {
        path: "/settings",
        loader: settingsLoader,
        element: <SettingsPage />,
    },
    {
        path: "*",
        element: <Navigate to="/" replace />,
    },
])

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found")

createRoot(root).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>
)
