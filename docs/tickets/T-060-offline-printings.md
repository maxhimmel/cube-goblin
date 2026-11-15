---
id: T-060
title: Optionally save every printing offline
status: todo
---

Printings are online-only by default ([T-058](T-058-offline.md)); the user wants an opt-in to also save them (user, 2026-11-15).

## Scope

- A toggle next to "Make available offline": also save every card's printings list and each printing's thumbnail.
- Warn that it greatly increases the cache (a card can have 80+ printings) and takes longer: each list is one `/cards/search` request at 2/second ([scryfall-api.md](../research/scryfall-api.md)).
- The cube menu shows whether printings are included and their size apart from the base copy.

## Done when

- With the toggle on and the network cut, the printing browser lists every printing with its thumbnail. e2e covers it.
