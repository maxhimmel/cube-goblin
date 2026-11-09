# Rendering and sharing: research

Researched 2026-11-08. Versions from `npm view` on that date. Plan discussion happens in chat; decisions get recorded in [tooling.md](tooling.md) once made.

## TanStack

- **Versions**: Start 1.169, Router 1.170, Query 5.107, Table 9.3, Virtual 3.14, DB 1.0.0-rc.
- **Start, SPA mode**: the shell is prerendered from the root route and the rest renders on the client ([docs](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode)).
- **Start, static prerendering**: crawls links by default ([docs](https://tanstack.com/start/latest/docs/framework/react/guide/static-prerendering)). There are community reports of `/` not prerendering in SPA mode ([thread](https://www.answeroverflow.com/m/1433464351284662414)).
- **Start's real value is server functions and SSR.** Output is multi-file and code-split, so no single-file recipe was found.
- **Router hash history** (`createHashHistory()`) suits hosting with no server and no rewrites ([docs](https://tanstack.com/router/latest/docs/guide/history-types)). That's what a `file://` page needs, since browser history needs a server to serve `index.html` for every route. Untested with `file://`, so prototype it.
- **DB LocalStorage collection**: local-only state that survives restarts and syncs across tabs. Mutate with `insert`/`update`/`delete`. Needs a `storageKey` and `getKey` ([docs](https://tanstack.com/db/latest/docs/collections/local-storage-collection)). Still a release candidate.

## Single-file export

- `vite-plugin-singlefile` 2.3.4 inlines JS and CSS into one HTML file. Nothing found on how it interacts with TanStack Router, so prototype first.
- **Card images**: Scryfall's `*.scryfall.io` hosts have no rate limit ([scryfall-api.md](scryfall-api.md)).
  - Embedding images makes the file work offline but larger.
  - Hotlinking keeps the file small but needs internet.
  - Image rules: no cropping, distorting, or recoloring.

## Proof-of-concept results (2026-11-08)

`apps/web/e2e/share-doc.spec.ts` covers all of this in Chromium, Firefox, and WebKit:

- **`file://` + hash routing + `localStorage`** work in all three. The `vite-plugin-singlefile` README says the same, and warns that history routing and lazy `import()` chunks don't work ([README](https://www.npmjs.com/package/vite-plugin-singlefile)).
- **Size**: about 2.9 MB for 143 cards with embedded `small` images (146×204 JPEG), 2 MB gzipped. Large images on the card page are hotlinked, so they need internet.
- **Self-saving HTML** works. At boot the app captures `document.documentElement.outerHTML` before React mounts. "Save copy" adds the review as a `<script type="application/json">` and downloads the result. The saved copy reopens with the review in a fresh profile.
- **Gotcha**: the inlined JS bundle contains `</head>` and the marker string, so the review tag must go right before the last `</body>`, never searched for from the front. See `packages/cube/src/embed.ts` and its tests.
- **Review code fallback**: `lz-string` compressed JSON. `pnpm cube review import` accepts a saved `.html`, a code, or `.json`.
- **Gotcha**: `lz-string` is CommonJS, so in Node ESM use a default import (`import lzString from "lz-string"`).

## Workbench dev server (2026-11-08)

- **Mode switch**: `vite.config.ts` aliases `#mode` to `src/modes/workbench.tsx` when `command === "serve"` and to `src/modes/share.tsx` for builds. The share doc build contains no workbench or TanStack Query code; `e2e/share-doc.spec.ts` checks this.
- **Write API**: a `configureServer` plugin (`server/workbench-plugin.ts`, `apply: "serve"`) adds middleware for `GET /api/cube` and `PUT /api/cards/:slug`, which calls `updateCard` in `@repo/cube` ([Vite plugin API](https://vite.dev/guide/api-plugin#configureserver)).
- **Live reload of data**: the plugin watches `cube/` with `server.watcher` and sends a custom `cube:changed` event with `server.ws.send`. The client invalidates the TanStack Query cache in `import.meta.hot.on` ([Vite HMR events](https://vite.dev/guide/api-plugin#client-server-communication), [Query invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)).
- **Gotcha**: Vite's default `bundle` config loader externalizes workspace packages, and Node then refuses their `.ts` sources (`ERR_UNKNOWN_FILE_EXTENSION`). `dev`, `build`, and the e2e `createServer` call use `configLoader: "runner"`, which Vite 8.3 marks `@experimental`.
- **Images** (updated 2026-11-09): the workbench serves card images through `GET /api/image?u=<scryfall url>` (`server/image-cache.ts`). It fetches each `cards.scryfall.io` URL once, at most 6 at a time, rejects non-image or truncated responses, and keeps the file in `.cache/scryfall-images`. The URL carries Scryfall's timestamp, so responses are marked immutable. Reason: in real Chrome some hotlinked grid images stayed blank until a reload, which fresh test browsers never reproduced. `CardImage` retries a failed image once, then shows the card name. Scryfall image hosts have no rate limit ([scryfall-api.md](scryfall-api.md)).
