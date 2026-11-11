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
import type { RememberedPath } from "./view-choices.ts";
import { isRemembered, recallSearch, rememberSearch } from "./view-choices.ts";

function restoreChoices(path: RememberedPath) {
  return ({
    search,
    cause,
    preload,
  }: {
    search: Record<string, unknown>;
    cause: "preload" | "enter" | "stay";
    preload: boolean;
  }): void => {
    if (preload || cause !== "enter") {
      return;
    }
    const saved = recallSearch(path, search);
    if (saved) {
      redirect({ to: path, search: { ...search, ...saved }, replace: true, throw: true });
    }
  };
}

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
  beforeLoad: restoreChoices("/"),
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
  beforeLoad: restoreChoices("/cards"),
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
  beforeLoad: restoreChoices("/insights"),
  validateSearch: (
    search: Record<string, unknown>,
  ): { scope?: string | undefined; bucket?: string | undefined; in?: string | undefined } => ({
    ...(typeof search["scope"] === "string" ? { scope: search["scope"] } : {}),
    ...(typeof search["bucket"] === "string" ? { bucket: search["bucket"] } : {}),
    ...(typeof search["in"] === "string" ? { in: search["in"] } : {}),
  }),
  component: InsightsPage,
});

const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tags",
  beforeLoad: restoreChoices("/tags"),
  validateSearch: (search: Record<string, unknown>): { tags?: string | undefined } => {
    const tags = parseTagList(search["tags"]);
    return tags.length > 0 ? { tags: tags.join(",") } : {};
  },
  component: () => <mode.TagsPage />,
});

const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/board",
  beforeLoad: restoreChoices("/board"),
  validateSearch: (search: Record<string, unknown>): { sort?: string | undefined } =>
    typeof search["sort"] === "string" ? { sort: search["sort"] } : {},
  component: () => <mode.BoardPage />,
});

const versionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/versions",
  validateSearch: (
    search: Record<string, unknown>,
  ): { from?: string | undefined; to?: string | undefined } => ({
    ...(typeof search["from"] === "string" ? { from: search["from"] } : {}),
    ...(typeof search["to"] === "string" ? { to: search["to"] } : {}),
  }),
  component: () => <mode.VersionsPage />,
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
    versionsRoute,
    addRoute,
  ]),
  history: createHashHistory(),
});

router.subscribe("onResolved", ({ toLocation }) => {
  const path = toLocation.pathname;
  if (!isRemembered(path)) {
    return;
  }
  const validate = router.routesByPath[path].options.validateSearch as
    ((search: Record<string, unknown>) => Record<string, unknown>) | undefined;
  rememberSearch(path, validate ? validate(toLocation.search) : toLocation.search);
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
