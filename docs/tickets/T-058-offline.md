---
id: T-058
title: Make a cube available offline
status: todo
---

The desktop app works offline for a cube that was opened online at least once (user, 2026-11-15). Most use is online; offline is rare.

## Decisions (user, 2026-11-15)

- No Scryfall bulk data: it's too hard to keep up to date and a bother. Offline means cached data only.
- A per-cube button, "Make available offline", fetches everything that cube needs.

## Scope

- The button prefetches, for every card in the cube (archived included): card data, the chosen printing, the printings list, oracle tags, and small and large images. It shows progress and keeps Scryfall's rate limits ([scryfall-api.md](../research/scryfall-api.md)).
- The Scryfall cache serves stale entries when offline instead of failing; today entries expire after 24h.
- The top bar shows offline state. Actions that need Scryfall (search, add, printings not yet cached, import resolving) are disabled with a reason, or fail with a clear message. Edits to cached cards keep working.
- Each cube shows whether it's fully cached and how big its cache is.

## Done when

- After the button runs, with the network cut, every view of that cube loads with images, and edits save. An e2e test that blocks the network covers this.
