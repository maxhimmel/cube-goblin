---
id: T-017
title: Choose a card's printing
status: done
---

Pick which printing (set, art, frame) each card shows, so the workbench and share doc match the physical cards (user, 2026-11-10).

## Decisions (user, 2026-11-10)

- A printing browser opens per card, from the detail pane.
- It loads a card's printings only when opened, so the cube never fetches every printing of every card.
- It lists every paper printing, including alternate art, borderless, showcase, Special Guests, and bonus sheets. Scryfall's `unique=prints` search returns these; `game:paper` drops digital-only ones ([scryfall-api.md](../research/scryfall-api.md#printings)).
- The chosen printing works offline: when it is saved, the server caches its card data and both images on disk, and card data is served stale when Scryfall can't be reached. Other printings are not kept: the list stays in server memory, and thumbnails load straight from Scryfall's image CDN.
- Every card starts on the printing it showed before this ticket: `pnpm cube pin-printings` saved each card's then-default printing, so a new Scryfall default can't change it.
- The control is a small caption under the card image ("Set #123 · change"), since it is a one-off.

## Done when

- Choosing a printing changes the card's image everywhere, survives a reload, and can be undone.
- "Default" goes back to Scryfall's default printing.
- The share doc shows the chosen printing.
