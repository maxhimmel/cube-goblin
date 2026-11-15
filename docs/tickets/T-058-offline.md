---
id: T-058
title: Make a cube available offline
status: done
---

The desktop app works offline for a cube that was opened online at least once (user, 2026-11-15). Most use is online; offline is rare.

## Decisions (user, 2026-11-15)

- No Scryfall bulk data: it's too hard to keep up to date and a bother. Offline means cached data only.
- A per-cube button, "Make available offline", fetches everything that cube needs.

## Scope

- The button prefetches, for every card in the cube (archived included): card data, the chosen printing, oracle tags, and small and large images. Printings are online-only (user, 2026-11-15); saving them is opt-in, in [T-060](T-060-offline-printings.md). It shows progress and keeps Scryfall's rate limits ([scryfall-api.md](../research/scryfall-api.md)).
- The Scryfall cache serves stale entries when offline instead of failing; today entries expire after 24h.
- The top bar shows offline state. Actions that need Scryfall (search, add, printings not yet cached, import resolving) are disabled with a reason, or fail with a clear message. Edits to cached cards keep working.
- Each cube shows whether it's fully cached and how big its cache is.

## Done when

- After the button runs, with the network cut, every view of that cube loads with images, and edits save. An e2e test that blocks the network covers this.

## Built (2026-11-15)

- **Cache**: printings lists now persist (`printings:<oracle id>`); card data, chosen printings, printings lists, and oracle tags fall back to stale entries when Scryfall can't be reached. Images never expired.
- **Prefetch**: `POST /api/offline` starts a run for the open cube (card data in batches, oracle tags, small and large images); `GET /api/offline` reports cards, cached cards, bytes, completeness, and the run's progress (`packages/server/src/offline.ts`). A cube's size counts its card data, any printings lists the browser saved, and images; oracle tags are shared and not counted.
- **Rate limits**: the first run hit a 429. Requests in a rate bucket now wait for the previous response plus the interval, and a 429 stops all Scryfall calls for 60s ([scryfall-api.md](../research/scryfall-api.md#rate-limit-lessons)).
- **Offline state**: the server wraps fetch and marks itself offline when a request fails, online when one answers; while offline, `GET /api/connection` probes Scryfall at most every 15s. The top bar shows "Offline"; the add panel turns search off; uncached printings, search, and adds answer 503 "Scryfall can't be reached, so …".
- **Desktop**: Scryfall calls stay on Node's `fetch`; a `net.fetch` attempt let the user's content filter swap in blank images ([desktop-shell.md](../research/desktop-shell.md#offline-testing)). The e2e cuts the network through a switch only hidden test launches have. Printing thumbnails now go through `/api/image`: the desktop CSP had blocked their direct Scryfall links, so the printing browser showed "image unavailable" (since T-056). The cube menu shows every recent cube's offline copy ("Available offline · 27 MB" or "N of M cards saved offline") and the open cube's "Make available offline" button with progress.
- **Printings online-only** (user, 2026-11-15): the button no longer saves printings lists, so a cold 143-card run takes about 6.5s (23 MB) instead of minutes. A list the printing browser fetched while online is still served offline. Opt-in: [T-060](T-060-offline-printings.md).
- **Review fixes**: the prefetch asked for one printings list at a time so search, adds, and edits didn't queue behind it (moot once printings left the prefetch); error pages that aren't JSON count as Scryfall errors and fall back to the cache; bulk downloads time out after 3 min.
- **Gaps**: other printings' thumbnails in the printing browser aren't prefetched, so they're blank offline; the CLI has no offline message; the web dev server has no button (no cube menu). From review, not fixed: any `TypeError` counts as unreachable (a code bug can show as "Scryfall can't be reached"); one failed image marks the app offline until the next probe; a stalled network costs two 15s timeouts before a cube loads from cache; a card whose chosen printing doesn't resolve never counts as saved.
