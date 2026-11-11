---
id: T-027
title: Filter widgets on Insights
status: done
---

The views mostly show the same cards through different filters. Let the user save their own filter and put it on the Insights dashboard ([T-015](T-015-insights-dashboard-layout.md)) as a block they can move, resize, collapse, hide, or delete. Built-in blocks can be hidden and shown again too (user, 2026-11-10).

## Decisions (user, 2026-11-10)

- **Filter parts**: chips taken from what the app can already filter by: status (the Insights scopes), color, mana value, card type, tags with and without (the Wall's `?with=&without=`), and every Insights drill-down bucket (`BUCKET_KINDS` in `packages/cube/src/stats.ts`, so anything you can click on a chart). The chips are ANDed and show the icons and labels the charts already use. A bucket's side panel gets a "Save as filter" action. Scryfall-style text queries are [T-028](T-028-filter-query-syntax.md).
- **Widget body**: card strips by default, with the count in the header. A switch reruns one of the existing charts on only the filter's cards.
- **Storage**: filters live in `cube/filters.json`, written by the workbench and baked into the share doc. Where blocks sit, and which are hidden, stays in localStorage with the rest of the layout.
- **Lifecycle**: collapse (already there), hide (a "Blocks" menu tucked into the Insights toolbar lists hidden blocks so they can come back), and delete (custom filters only, with an undo toast). No separate archive state.

## Done when

- "Filter" is in the [glossary](../GLOSSARY.md), checked against Cube Cobra's filter.
- A filter can be built from chips, named, saved, edited, and deleted on `#/insights` in the workbench; it survives a reload because it lives in `cube/filters.json`.
- A bucket's side panel can save that bucket as a filter.
- Each filter block lists exactly the cards its chips match (unit-tested with `inBucket`), and can switch to a chart.
- Any block, built-in or custom, can be hidden and brought back from the Blocks menu; "Reset layout" brings every block back.
- The share doc shows the saved filters read-only.
- E2E covers create, hide, show, and delete.

## What shipped

- **Model**: `packages/cube/src/filters.ts` (`matchesFilter`, `filterCards`, `cycleChip`, prune and validate). A filter with no status chip counts the page's scope; one with a status chip counts the whole cube. `pnpm cube validate` checks `cube/filters.json`, the server prunes chips whose tag is gone (`GET`/`PUT /api/filters`), and the snapshot carries filters.
- **Editor**: "+ New filter" (workbench) opens a dialog of chip rows: status, color, has color, mana value, card type, tags, plus "From charts" for buckets saved from a chart. Clicking a chip includes it, again excludes it (struck through), again clears it. A live count shows the matches. A bucket's side panel has "Save as filter", which starts from its bucket (and the filter's chips, when the bucket came from a filter's chart).
- **Block**: header with name, count, a "Show as" select (Cards or any chart, saved to the file), Edit, collapse, and hide. Chart clicks inside a filter open the side panel on the filter's cards (`?in=<filter id>`). The share doc shows filters read-only; its "Show as" choice stays in the page.
- **Hiding**: every block has × in its header. The toolbar's "Blocks" menu lists every block with a checkbox and counts the hidden ones; "Reset layout" shows them all again. Hidden blocks live in localStorage with the layout.
- **Review (independent, 2026-11-10)**: fixed id reuse after delete (Undo could replace a new filter), "Save as filter" from a filter's chart now narrows same-kind chips, and a stale `?in=` falls back to the page. The hover preview now renders in a portal, since grid blocks are transformed (user report, 2026-11-11).
- **Known gaps**: renaming a tag drops it from filters (same as Board sections); a new filter block starts at the bottom of the grid, and the page scrolls to it; like the Board, a late refetch could in theory overwrite the last confirmed save before the next one (not seen on localhost).
