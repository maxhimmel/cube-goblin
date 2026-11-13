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
import type { TagMode } from "./overlaps/tags-view.tsx";
import { isTagMode } from "./overlaps/tags-view.tsx";
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
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string | undefined; keep?: true | undefined } => ({
    ...(typeof search["q"] === "string" ? { q: search["q"] } : {}),
    ...(search["keep"] === true ? { keep: true as const } : {}),
  }),
  beforeLoad: ({ search }) => {
    const query = search.q?.trim();
    if (query === undefined) {
      return;
    }
    if (query !== "" && compileQuery(query).ok) {
      const pills = recallState("lab.pills", z.array(z.string())) ?? [];
      const pill = `x:${query}`;
      const kept = search.keep ? pills.filter((other) => other !== pill) : [];
      rememberState("lab.pills", [...kept, pill]);
    }
    redirect({
      to: "/",
      search: (prev) => ({ ...prev, q: undefined, keep: undefined }),
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
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode?: TagMode | undefined; tags?: string | undefined; sort?: string | undefined } => {
    const tags = parseTagList(search["tags"]);
    return {
      ...(isTagMode(search["mode"]) ? { mode: search["mode"] } : {}),
      ...(tags.length > 0 ? { tags: tags.join(",") } : {}),
      ...(typeof search["sort"] === "string" ? { sort: search["sort"] } : {}),
    };
  },
  component: () => <mode.TagsPage />,
});

const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/board",
  validateSearch: (search: Record<string, unknown>): { sort?: string | undefined } =>
    typeof search["sort"] === "string" ? { sort: search["sort"] } : {},
  beforeLoad: ({ search }) => {
    redirect({
      to: "/tags",
      search: (prev) => ({ ...prev, ...search, mode: "sketch" as const }),
      replace: true,
      throw: true,
    });
  },
});

function validatePoints(search: Record<string, unknown>): {
  from?: string | undefined;
  to?: string | undefined;
} {
  return {
    ...(typeof search["from"] === "string" ? { from: search["from"] } : {}),
    ...(typeof search["to"] === "string" ? { to: search["to"] } : {}),
  };
}

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  validateSearch: validatePoints,
  component: () => <mode.HistoryPage />,
});

const versionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/versions",
  validateSearch: validatePoints,
  beforeLoad: () => {
    redirect({ to: "/history", search: (prev) => prev, replace: true, throw: true });
  },
});

const logRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/log",
  beforeLoad: () => {
    redirect({ to: "/history", search: (prev) => prev, replace: true, throw: true });
  },
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
    historyRoute,
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
