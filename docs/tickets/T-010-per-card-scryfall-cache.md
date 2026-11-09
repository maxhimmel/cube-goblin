---
id: T-010
title: Per-card Scryfall cache
status: done
---

The workbench loads card data with Scryfall's `/cards/collection` in chunks of 75, and the file cache keys each response by its full identifier list. Adding a card shifts every later chunk, so the next load re-fetches most of the cube (about 0.5s per chunk at Scryfall's 2 requests/second; see [scryfall-api.md](../research/scryfall-api.md)). Cache card data per oracle id instead, so an add fetches only the new card.

## Done when

- Adding one card to the cube makes at most one Scryfall request on the next workbench load, proven by a test.
- Cached card data still expires after 24h, which is the minimum Scryfall asks for.
