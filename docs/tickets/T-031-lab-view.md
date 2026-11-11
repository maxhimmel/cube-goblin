---
id: T-031
title: Lab view
status: done
---

One workbench view to see every card in contention, lay out charts and filter blocks as the user likes, apply filters that change the card area at once, make edits, and watch the stats move (user, 2026-11-11). Built after the [spike](T-030-lab-spike.md) picks a direction, and after query filters ([T-028](T-028-filter-query-syntax.md)), which its pills use.

## Decisions (user, 2026-11-11)

- **Place**: a new view, `#/lab`, workbench only. Wall, Insights, and Board stay; retiring any is a later call. The share doc gets it under [T-006](T-006-share-doc-polish.md).
- **Cards**: draft and prospects, with a toggle that shows cut cards.
- **Card area**: the Wall's columns (draft over prospects), or "Group by: none", one sorted column that turns into a dense grid when tall. Sorting uses the chain from [T-032](T-032-sort-chain.md).
- **Filters**: applied filters stack (AND) as pills in the toolbar. Clicking a chart bar adds a pill; "Save as filter" saves the stack. Cards that don't match are dimmed by default, or hidden by a switch. Hovering a filter block, a tag, or a chart bar dims to that bucket while hovered (peek); clicking applies it.
- **Typing** (user, 2026-11-11): the query being typed is a live filter; the cards and charts follow every keystroke that parses. Enter applies it as a pill; an applied query pill has a Save button that names it and keeps it as a saved filter, so saving comes after trying it, not during creation.
- **Charts**: each block follows the filter (default) or is pinned to a scope. While a filter is on, every chart draws the unfiltered scope faint behind the filtered cards (bars: a faint full bar; heatmap: a faint count and a solid inner fill; dots: faint non-matching dots). A global toggle, on by default, turns that baseline off, and each block can override it.
- **Edits**: what exists today: drag between draft and prospects (and cut), and the detail pane.
- **Live stats**: charts animate after a drop, and show a ghost delta while a card is dragged or hovered over a target.
- **Empty**: Hide empty ([T-033](T-033-hide-empty.md)) applies here.
- **Layouts**: every setting saves as soon as it changes and comes back on reload. Named layouts are optional snapshots (blocks, grouping and sort, toggles, applied pills) saved to a file in `cube/`, to switch between setups.

## Direction

Build [variant C of the spike](T-030-lab-spike.md#verdict-user-2026-11-11): a chart dock (any Insights chart plus the live curve, color by mana value, and power by toughness charts; reorder, collapse, hide, move to any side, collapse whole), tags and saved filters as dock blocks, Columns or Rows for the cards, draft and prospects side by side.

## Done when

- Every decision above works in the workbench, with e2e coverage of drag, filter pills, peek, and a named layout surviving a reload.

## Built (2026-11-11)

- Variant C is the Lab; variants A and B and `?variant=` are gone. Code: `apps/web/src/lab/` (`use-lab.ts` state, `cards.tsx` card area, `toolbar.tsx`, `dock.tsx`, `layouts-menu.tsx`, `lab-charts.tsx`, `model.ts`).
- Each dock block has a scope select (Follows filter, Draft, Draft + prospects, All cards), and each Lab chart that follows the filter has a ◐ button that overrides the global Baseline switch. Both are remembered.
- Group by None flows the sorted cards into newspaper columns.
- With two or more pills, "Save as filter" saves the stack as one [filter](../GLOSSARY.md#filter) (`stackQuery` in `model.ts`) and replaces the pills with it.
- Named [layouts](../GLOSSARY.md#layout) live in `cube/layouts.json` (`GET`/`PUT /api/layouts`) and snapshot every remembered `lab.*` and `labc.*` setting; picking one restores them.
- A card opened in the detail pane (`?card=`) stays outlined, and every chart and the draft count preview its move between draft and prospects until the pane closes; a hover or drag adds its own move on top, so both show together (user, 2026-11-11).
- E2E: drag, typed and applied pills, peek, hide, saving a pill and a stack, pinning, and a layout surviving a reload.

Not covered here: Insights chart blocks in the dock don't peek on hover, draw a baseline, or show ghost deltas ([T-035](T-035-lab-insights-blocks.md)); sorting waits on [T-032](T-032-sort-chain.md) and Hide empty on [T-033](T-033-hide-empty.md).
