import { mode } from "#mode";
import {
  Outlet,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { CardPage } from "./pages/card-page.tsx";
import { GridPage } from "./pages/grid-page.tsx";
import { WallPage } from "./pages/wall-page.tsx";
import { Shell } from "./shell.tsx";

const rootRoute = createRootRoute({
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
});

const gridRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>): { by?: string } =>
    typeof search["by"] === "string" ? { by: search["by"] } : {},
  component: GridPage,
});

const cardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/card/$slug",
  component: CardPage,
});

const wallRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/wall",
  validateSearch: (search: Record<string, unknown>): { by?: string } =>
    typeof search["by"] === "string" ? { by: search["by"] } : {},
  component: WallPage,
});

const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tags",
  component: () => <mode.TagsPage />,
});

const addRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/add",
  validateSearch: (search: Record<string, unknown>): { replaces?: string } =>
    typeof search["replaces"] === "string" ? { replaces: search["replaces"] } : {},
  component: function AddRoute() {
    const { replaces } = addRoute.useSearch();
    return <mode.AddPage replaces={replaces} />;
  },
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([gridRoute, wallRoute, cardRoute, tagsRoute, addRoute]),
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
