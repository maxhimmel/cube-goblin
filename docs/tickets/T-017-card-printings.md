---
id: T-017
title: Choose a card's printing
status: doing
---

Pick which printing (set, art, frame) each card shows, so the workbench and share doc match the physical cards (user, 2026-11-10).

## Decisions (user, 2026-11-10)

- A printing browser opens per card, from the detail pane.
- It loads a card's printings only when opened, so the cube never fetches every printing of every card.
- It lists every paper printing, including alternate art, borderless, showcase, Special Guests, and bonus sheets. Scryfall's `unique=prints` search returns these; `game:paper` drops digital-only ones ([scryfall-api.md](../research/scryfall-api.md#printings)).
- The choice is saved on the card; printings lists and images are cached on disk.

## Done when

- Choosing a printing changes the card's image everywhere, survives a reload, and can be undone.
- "Default" goes back to Scryfall's default printing.
- The share doc shows the chosen printing.
