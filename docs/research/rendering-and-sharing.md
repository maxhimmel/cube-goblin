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

## Open questions to prototype

- Does a single-file build with hash routing open from `file://` in Chrome, Safari, and Firefox?
- File size with about 100 embedded `small` images.
- Can the page re-save itself with state embedded (a self-saving HTML file) across browsers? Fallbacks: download a JSON file, or copy a compressed code (`lz-string` 1.5.0).
