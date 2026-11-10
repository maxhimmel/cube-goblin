---
id: T-012
title: Tag overlap view
status: done
---

The Tags view in [views.md](../design/views.md): see how tags overlap and filter by an overlap. A Venn diagram suits two or three tags; more need a matrix of combinations with counts. Load the `dataviz` skill first.

## Done when

- Picking tags shows every overlap with its count.
- Clicking an overlap filters the Wall to those cards.

## Built (2026-11-10)

- `#/tags?tags=a,b,c` in both modes (a nav view now; the workbench keeps tag management below it). It counts draft and prospect cards, the cards the Wall shows.
- A Venn diagram for two or three picked tags (fixed circles, not area-proportional; counts sit in each region), plus a matrix of every non-empty [overlap](../GLOSSARY.md#overlap) with a bar per count, for any number of tags.
- Clicking a Venn region or a matrix row opens the Wall at `?with=…&without=…`, with a filter bar ("Clear filter") and "Draft N of M".
- Covered by unit tests (`overlaps.test.ts`, the Venn layout in `geometry.test.ts`) and e2e in both the workbench and the share doc.
