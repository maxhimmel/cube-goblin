---
id: T-032
title: Unlimited sort chain
status: done
---

"Sort cards by … then …" stops at two keys. Let it take any number ("+ then"), with the same control on the Board and the [Lab](T-031-lab-view.md) (user, 2026-11-11). Keys include power and toughness.

## Done when

- The Board's `?sort=` takes any number of keys, survives a reload, and is unit-tested.

## Built (2026-11-11)

- `SortChain` (`apps/web/src/sort-chain.tsx`) always ends in an empty "then" select; picking it adds a key, and picking "—" on a middle one drops it. Keys: added, name, mana value, color, card type, power, toughness (non-creatures and `*` last). `parseSortKeys` and `formatSortKeys` (`packages/cube/src/sort.ts`) read and write `?sort=` on the Board.
- The Lab sorts every column and the None flow with its own chain (`lab.sort`, default mana value then color), saved in layouts.
