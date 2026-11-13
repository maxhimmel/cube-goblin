---
id: T-053
title: Forge charts polish
status: doing
---

Feedback on [Forge](../GLOSSARY.md#forge) charts after [T-052](T-052-forge-polish.md) (user, 2026-11-13). Part of [T-043](T-043-polish-pass.md).

## Asked for

- The collapse handle sits off the seam line when the charts are collapsed on the right, left, or bottom; it reads as detached and is hard to see. The arrow for the side the charts are already on gets its own icon.
- Charts in a top or bottom panel don't fill the panel's height (Curve, Creature balance, and others).
- The chart panel and chart tiles swallow the scroll wheel, so the page won't scroll while the pointer is over them.
- Empty cells in Color × mana value and Power × toughness: some apply a filter that matches nothing, others ignore the click. Empty cells should ignore it.
- One multicolor symbol, the same size as the other mana symbols, everywhere; try a gold sparkle.
- With filters applied, hovering a chart or typing a query previews as if the applied filters were off.
- Combat matchups: the kills and survives axis labels are centered inconsistently.

## Done when

- Each item above is fixed and checked in the running app at 1440px and 900px.
