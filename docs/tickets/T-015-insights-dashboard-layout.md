---
id: T-015
title: Insights dashboard layout
status: doing
---

Make the Insights blocks ([T-004](T-004-stats-and-charts.md)) a dashboard the user arranges: drag to reorder, resize, and collapse each block, with the others reflowing as sizes change (user, 2026-11-09).

## Decisions (user, 2026-11-09)

- **Saving**: in the browser only (localStorage), per browser. The share doc starts from the default layout, and each reader can rearrange their own copy.

## Done when

- Blocks can be dragged, resized, and collapsed; the rest move up to fill gaps.
- Charts redraw to fit their block's new size.
- The layout survives a reload, and a reset returns the default.
