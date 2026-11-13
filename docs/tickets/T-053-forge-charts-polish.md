---
id: T-053
title: Forge charts polish
status: done
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

## Built (2026-11-13)

- The seam handle stays on its line in every state: a collapsed seam widens to a 48px rail so the hover disc fits on screen. The arrow for the current side shows a dot; its tooltip says "Show charts on the …" when collapsed.
- In a top or bottom panel, every chart stretches to the tile's height.
- The chart panel no longer contains scroll, so the wheel passes to the page.
- An empty cell in either grid chart (nothing drawn) ignores hover and clicks.
- Hide mode keeps applied-filter non-matches hidden while peeking or typing; the peek dims within them.
- Combat matchups: both axis labels center on the plot.
- Multicolor symbol (user, 2026-11-13, after about 40 mocked options): a pip the size of the other mana symbols, a star in the colorless outline on a wheel of the other four colors. The user liked two equally, so Forge settings switches between a black star with the outline (default) and a white star without (`MulticolorSymbol` in `apps/web/src/mana.tsx`).
