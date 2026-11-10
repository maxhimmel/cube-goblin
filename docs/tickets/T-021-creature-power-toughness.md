---
id: T-021
title: Creature power and toughness
status: done
---

Show how big the creatures are (user, 2026-11-10).

## Decisions (2026-11-10)

- A heatmap of power (rows) by toughness (columns), like Color by mana value. Values cap at 6+; a power or toughness that isn't a plain number (`*`, `1+*`, `X`) counts as `*`.
- Creatures are cards with Creature on the front face; a Vehicle's printed power and toughness don't count.

## Done when

- Card data carries power and toughness from Scryfall.
- Insights shows creatures by power and toughness, with a table view and drill-down.
