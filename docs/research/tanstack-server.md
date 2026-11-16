# TanStack server pieces vs. the T-062 gate: research

Researched 2026-11-16. Versions from `npm view` on that date: `@tanstack/react-start` 1.169.5, `start-server-core` 1.169.45, `start-client-core` 1.170.39, `start-plugin-core` 1.171.56, `router-core` 1.171.39, `react-router` 1.170.46, `react-query` 5.107.1, `db` 1.0.0-rc.1.5. Context: [T-062](../tickets/T-062-cross-origin-gate.md) plans a hand-built route table wrapped in one deny-by-default gate ([rules](cross-origin-protection.md#recommendation-for-this-repo)). Start was passed over on 2026-11-08 for the single-file share doc ([rendering-and-sharing.md](rendering-and-sharing.md#tanstack)). Source read from the npm tarballs and the matching GitHub tags.

## Start's server side

- **Server routes**: declared per file in `src/routes`, as a `server` property on `createFileRoute('/path')({ server: { handlers: { GET, POST, ... }, middleware } })`. Route-level `middleware` covers every handler on that route, and each handler can add its own ([server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)). Start's docs build routes from files. Server routes need the generated route tree ([routing](https://tanstack.com/start/latest/docs/framework/react/guide/routing)).
- **Server functions**: `createServerFn`, same-origin RPC under `/_serverFn/*`, with function middleware (`.client`, `.validator`, `.server`) ([server functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions), [middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware)).
- **Global middleware, set once**: `src/start.ts` exports `createStart(() => ({ requestMiddleware: [...], functionMiddleware: [...] }))`. Docs: "Global **request** middleware runs before **every request, including server routes, SSR and server functions**" ([middleware § Global](https://tanstack.com/start/latest/docs/framework/react/guide/middleware#global-middleware)). So yes, one middleware can wrap every route and function once.

## CSRF / cross-origin protection

- **Ships since 1.16x**: `createCsrfMiddleware` landed in [PR #7373](https://github.com/TanStack/router/pull/7373) (2026-05-09), exported from `@tanstack/react-start` ([docs § CSRF Middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware#csrf-middleware)).
- **Default scope is server functions only**: with no `src/start.ts`, Start installs `createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })` for server-function requests (`requestMiddleware: startInstance ? startOptions.requestMiddleware : isServerFnRequest ? [defaultCsrfMiddleware] : void 0`, [createStartHandler.ts](https://github.com/TanStack/router/blob/%40tanstack/start-server-core%401.169.45/packages/start-server-core/src/createStartHandler.ts)). With a custom `start.ts` you add it yourself. If you don't, Start logs a warning in development only, and `serverFns.disableCsrfMiddlewareWarning` turns that off. Server routes are covered only if you register it without the filter or per route.
- **Algorithm** ([createCsrfMiddleware.ts](https://github.com/TanStack/router/blob/%40tanstack/start-client-core%401.170.39/packages/start-client-core/src/createCsrfMiddleware.ts)), all methods:
  1. `Sec-Fetch-Site` present: must match `secFetchSite` (default `'same-origin'` only, so `none` is **rejected**). It decides alone; Origin isn't checked.
  2. Else `Origin` present: must equal `new URL(request.url).origin` (or the `origin` option). `null` fails.
  3. Else `Referer` (default on): must be same-origin.
  4. No headers at all: **rejected** unless `allowRequestsWithoutOriginCheck: true`.
  5. Failure: `403 Forbidden`, or `failureResponse`. `filter` gives the opt-out.
- **Gaps against our rules**: no `initiatorOrigin` (Electron), no Host allowlist (DNS rebinding), `none` refused by default, header-less refused by default. Each of these can be configured (`secFetchSite: ['same-origin','none']`, `allowRequestsWithoutOriginCheck`, a custom `origin` matcher with `ctx`), except a Host check, which would be extra middleware.
- **Advisories** ([Security tab](https://github.com/TanStack/router/security/advisories)): none for CSRF. Recent ones: GHSA-qx66-fv34-fjm8 (critical, reflected XSS via server-function responses, `start-server-core` fixed in 1.169.39), GHSA-9m65-766c-r333 (deserialization calling a sibling server function), GHSA-g7cv-rxg3-hmpx (malware in 42 `@tanstack/*` packages, 2026-05-11).

## Mounting in our hosts

- **Fetch entry exists**: the server entry's default export has `fetch(request, opts) => Response`, the "universal fetch handler format" ([server entry point](https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point)). Rsbuild builds emit `dist/server/index.js` exporting `{ fetch(request) }`, and "any other custom Node.js server works" ([hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting#nodejs--docker)). Vite builds go through Nitro.
- **Vite dev**: Start's own plugin adds a catch-all `viteDevServer.middlewares.use(async (req, res) => ...)` that calls `serverRunner.import(server entry).default.fetch(webReq)` and never calls `next` ([dev-server-plugin](https://github.com/TanStack/router/blob/%40tanstack/start-plugin-core%401.171.56/packages/start-plugin-core/src/vite/dev-server-plugin/plugin.ts)). It takes over the dev server rather than sitting beside our `workbench-plugin.ts`. `installDevServerMiddleware: false` turns it off.
- **Electron**: no Electron or desktop guide in Start's docs. An open issue reports a Start SPA stuck pending under Tauri's custom protocol with a basepath and notes Electron would be similar ([#8936](https://github.com/TanStack/router/issues/8936), fix in [PR #8938](https://github.com/TanStack/router/pull/8938)). Calling the built `fetch` from `protocol.handle` looks possible from the contract, but nobody documents it.

## Fit with this repo

- **Share doc**: Start's output is a multi-file client plus a server bundle, and SPA mode prerenders a `/_shell.html` that needs host rewrites ([SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode)). None of that fits `file://` + `vite-plugin-singlefile`. The share build would have to stay a separate plain-Vite build outside Start.
- **Hash history**: Router supports it ([history types](https://tanstack.com/router/latest/docs/guide/history-types)). Start's docs say nothing about it, and SSR/shell rendering assumes path URLs.
- **Cost of adopting Start**: new deps (`@tanstack/react-start`, plus Nitro or Rsbuild for production). Move our code-based `router.tsx` to the `getRouter`/`routeTree.gen` layout, rewrite ~20 `/api` branches as `createFileRoute` files, add `src/start.ts`, split the Vite config so the share build skips Start, swap `workbench-plugin.ts` for Start's dev middleware, and invent the Electron mount. That's roughly 25–35 files and two build pipelines. The hand-built table changes about 5 files (`workbench.ts`, `cubes.ts`, a new gate plus its test, the Vite adapter) with no new deps.

## Smaller pieces

- **Router path matching**: `router-core` exports `interpolatePath`, `resolvePath`, `joinPaths`, `cleanPath` ([index.ts](https://github.com/TanStack/router/blob/%40tanstack/router-core%401.171.39/packages/router-core/src/index.ts)). The matcher itself (`new-process-route-tree.ts`) isn't in the package's public exports. That leaves nothing public worth borrowing for a server route table, and `URLPattern` or a split on `/` covers our patterns.
- **`createCsrfMiddleware` alone**: it returns a Start middleware object (`createMiddleware().server(...)`) that expects Start's context (`ctx.request`, `ctx.next`). Reusing it means depending on `start-client-core` and driving its middleware runtime by hand. The algorithm is ~60 lines, worth copying as a reference.
- **Query / DB**: client-side caching and collections ([Query](https://tanstack.com/query/latest/docs/framework/react/overview), [DB](https://tanstack.com/db/latest/docs/overview)). Neither has server-API or origin features relevant here.

## Recommendation for this repo

**Keep the hand-built table and gate.** Treat TanStack's `createCsrfMiddleware` as a cross-check, not a dependency.

- Start does give one global middleware over every route and server function, plus a ready CSRF check. But its default covers server functions only, and it lacks `initiatorOrigin` and a Host check. It would also rewrite our routing, replace our Vite plugin, and leave the share doc and Electron mount on our own.
- No smaller TanStack piece is public and server-usable: the route matcher is internal, and the CSRF middleware is a Start middleware object.
- **Borrow from Start's algorithm**: reject unknown `Sec-Fetch-Site` values, give `Referer` a same-origin fallback, and return a plain `403 Forbidden`. Note two deliberate differences in the gate: it allows `none`, and it allows header-less requests (curl, tests, Electron).
- Revisit if the workbench ever needs SSR or server functions. Even then, keep the share doc as a separate build.
