---
id: T-032
title: Unlimited sort chain
status: done
---

"Sort cards by … then …" stops at two keys. Let it take any number ("+ then"), with the same control on the Board and the [Lab](T-031-lab-view.md) (user, 2026-11-11). Keys include power and toughness.

## Done when

- The Board's `?sort=` takes any number of keys, survives a reload, and is unit-tested.

## Built (2026-11-11)

- `SortChain` (`apps/web/src/sort-chain.tsx`): keys read as plain text with a caret; a faint "+ then" opens a select for the next key, and "— remove" on a key drops it (made quieter at the user's request, 2026-11-11). Keys: added, name, mana value, color, card type, power, toughness (non-creatures and `*` last). `parseSortKeys` and `formatSortKeys` (`packages/cube/src/sort.ts`) read and write `?sort=` on the Board.
- The Lab sorts every column and the None flow from a "⇅" Sort menu beside Group by, so sorting takes no row of its own (user: viewing every card matters more than sorting). Each grouping keeps its own chain (`lab.sorts`; defaults: mana value → color, color → mana value, card type and none → mana value, color), saved in layouts.
