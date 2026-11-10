---
id: T-027
title: Filter widgets on Insights
status: todo
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
