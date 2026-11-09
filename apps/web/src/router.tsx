import { mode } from "#mode";
import {
  Outlet,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { InsightsPage } from "./insights/insights-page.tsx";
import { GridPage } from "./pages/grid-page.tsx";
import { WallPage } from "./pages/wall-page.tsx";
import { Shell } from "./shell.tsx";

function byParam(search: Record<string, unknown>): { by?: string | undefined } {
  return typeof search["by"] === "string" ? { by: search["by"] } : {};
}

const rootRoute = createRootRoute({
  validateSearch: (search: Record<string, unknown>): { card?: string | undefined } =>
    typeof search["card"] === "string" ? { card: search["card"] } : {},
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
});

const wallRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: byParam,
  component: WallPage,
});

const gridRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cards",
  validateSearch: byParam,
  component: GridPage,
});

const cardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/card/$slug",
  beforeLoad: ({ params }) => {
    redirect({ to: "/", search: { card: params.slug }, replace: true, throw: true });
  },
});

const insightsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/insights",
  component: InsightsPage,
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
  routeTree: rootRoute.addChildren([
    wallRoute,
    gridRoute,
    insightsRoute,
    cardRoute,
    tagsRoute,
    addRoute,
  ]),
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
