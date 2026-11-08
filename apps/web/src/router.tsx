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
  component: GridPage,
});

const cardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/card/$slug",
  component: CardPage,
});

const tagsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/tags",
  component: () => <mode.TagsPage />,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([gridRoute, cardRoute, tagsRoute]),
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
