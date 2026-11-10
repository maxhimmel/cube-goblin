import { mode } from "#mode";
import { parseTagList } from "@repo/cube/browser";
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

function tagListParam(
  search: Record<string, unknown>,
  key: "with" | "without",
): Partial<Record<"with" | "without", string>> {
  const tags = parseTagList(search[key]);
  return tags.length > 0 ? { [key]: tags.join(",") } : {};
}

const wallRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (
    search: Record<string, unknown>,
  ): { by?: string | undefined; with?: string | undefined; without?: string | undefined } => ({
    ...byParam(search),
    ...tagListParam(search, "with"),
    ...tagListParam(search, "without"),
  }),
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
  validateSearch: (
    search: Record<string, unknown>,
  ): { scope?: string | undefined; bucket?: string | undefined } => ({
    ...(typeof search["scope"] === "string" ? { scope: search["scope"] } : {}),
    ...(typeof search["bucket"] === "string" ? { bucket: search["bucket"] } : {}),
  }),
  component: InsightsPage,
});

const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tags",
  validateSearch: (search: Record<string, unknown>): { tags?: string | undefined } => {
    const tags = parseTagList(search["tags"]);
    return tags.length > 0 ? { tags: tags.join(",") } : {};
  },
  component: () => <mode.TagsPage />,
});

const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/board",
  validateSearch: (search: Record<string, unknown>): { sort?: string | undefined } =>
    typeof search["sort"] === "string" ? { sort: search["sort"] } : {},
  component: () => <mode.BoardPage />,
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
    boardRoute,
    addRoute,
  ]),
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
