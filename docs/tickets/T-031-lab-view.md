---
id: T-031
title: Lab view
status: todo
---

One workbench view to see every card in contention, lay out charts and filter blocks as the user likes, apply filters that change the card area at once, make edits, and watch the stats move (user, 2026-11-11). Built after the [spike](T-030-lab-spike.md) picks a direction, and after query filters ([T-028](T-028-filter-query-syntax.md)), which its pills use.

## Decisions (user, 2026-11-11)

- **Place**: a new view, `#/lab`, workbench only. Wall, Insights, and Board stay; retiring any is a later call. The share doc gets it under [T-006](T-006-share-doc-polish.md).
- **Cards**: draft and prospects, with a toggle that shows cut cards.
- **Card area**: the Wall's columns (draft over prospects), or "Group by: none", one sorted column that turns into a dense grid when tall. Sorting uses the chain from [T-032](T-032-sort-chain.md).
- **Filters**: applied filters stack (AND) as pills in the toolbar. Clicking a chart bar adds a pill; "Save as filter" saves the stack. Cards that don't match are dimmed by default, or hidden by a switch. Hovering a filter block, a tag, or a chart bar dims to that bucket while hovered (peek); clicking applies it.
- **Charts**: each block follows the filter (default) or is pinned to a scope. While a filter is on, every chart draws the unfiltered scope faint behind the filtered cards (bars: a faint full bar; heatmap: a faint count and a solid inner fill; dots: faint non-matching dots). A global toggle, on by default, turns that baseline off, and each block can override it.
- **Edits**: what exists today: drag between draft and prospects (and cut), and the detail pane.
- **Live stats**: charts animate after a drop, and show a ghost delta while a card is dragged or hovered over a target.
- **Empty**: Hide empty ([T-033](T-033-hide-empty.md)) applies here.
- **Layouts**: every setting saves as soon as it changes and comes back on reload. Named layouts are optional snapshots (blocks, grouping and sort, toggles, applied pills) saved to a file in `cube/`, to switch between setups.

## Done when

- Every decision above works in the workbench, with e2e coverage of drag, filter pills, peek, and a named layout surviving a reload.
