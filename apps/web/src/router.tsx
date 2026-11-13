import { mode } from "#mode";
import { compileQuery, parseTagList } from "@repo/cube/browser";
import {
  Outlet,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { InsightsPage } from "./insights/insights-page.tsx";
import { ForgePage } from "./forge/forge-page.tsx";
import { Shell } from "./shell.tsx";
import type { RememberedPath } from "./view-choices.ts";
import {
  isRemembered,
  recallSearch,
  recallState,
  rememberSearch,
  rememberState,
} from "./view-choices.ts";
import { z } from "zod";

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

const rootRoute = createRootRoute({
  validateSearch: (
    search: Record<string, unknown>,
  ): { card?: string | undefined; add?: true | undefined; replaces?: string | undefined } => ({
    ...(typeof search["card"] === "string" ? { card: search["card"] } : {}),
    ...(search["add"] === true ? { add: true as const } : {}),
    ...(search["add"] === true && typeof search["replaces"] === "string"
      ? { replaces: search["replaces"] }
      : {}),
  }),
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
});

const forgeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>): { q?: string | undefined } =>
    typeof search["q"] === "string" ? { q: search["q"] } : {},
  beforeLoad: ({ search }) => {
    const query = search.q?.trim();
    if (query === undefined) {
      return;
    }
    if (query !== "" && compileQuery(query).ok) {
      const pills = recallState("lab.pills", z.array(z.string())) ?? [];
      const pill = `x:${query}`;
      rememberState("lab.pills", pills.includes(pill) ? pills : [...pills, pill]);
    }
    redirect({
      to: "/",
      search: (prev) => ({ ...prev, q: undefined }),
      replace: true,
      throw: true,
    });
  },
  component: ForgePage,
});

const gridRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cards",
  beforeLoad: () => {
    rememberState("labc.view", "images");
    redirect({ to: "/", search: (prev) => prev, replace: true, throw: true });
  },
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

const logRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/log",
  component: () => <mode.LogPage />,
});

const labRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lab",
  beforeLoad: () => {
    redirect({ to: "/", search: (prev) => prev, replace: true, throw: true });
  },
});

const addRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/add",
  validateSearch: (search: Record<string, unknown>): { replaces?: string | undefined } =>
    typeof search["replaces"] === "string" ? { replaces: search["replaces"] } : {},
  beforeLoad: ({ search: { replaces } }) => {
    redirect({
      to: "/",
      search: { add: true, ...(replaces === undefined ? {} : { replaces }) },
      replace: true,
      throw: true,
    });
  },
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    forgeRoute,
    gridRoute,
    insightsRoute,
    cardRoute,
    tagsRoute,
    boardRoute,
    versionsRoute,
    logRoute,
    labRoute,
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
