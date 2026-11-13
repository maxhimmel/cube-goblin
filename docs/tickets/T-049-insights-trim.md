---
id: T-049
title: Insights trim
status: done
---

Part of [T-043](T-043-polish-pass.md). Insights stays for bigger charts and deeper detail (user, 2026-11-12) but is about 5,000px tall at 1440px, with uneven block widths and gaps.

- Cut what the merged view ([T-046](T-046-wall-and-lab.md)) already shows, and the Status chart (it repeats the draft count).
- Drop zero rows (Card types lists Planeswalker 0 and Land 0) and the land tiles while the cube has no lands.
- The Groups chart shows the top tags and folds the rest.
- Blocks pack without gaps.

## Done when

- Every remaining block has a job the merged view doesn't do, the page packs tightly at 900px and 1440px, and e2e follows.

## Built (2026-11-13)

- Deep-only (user, 2026-11-13): Insights keeps Color by mana value, Power and toughness, Creature balance, Combat matchups, and filter blocks. Summary, Mana curve, Color, Heavy pips, Card types, Status, and Tags are cut; Forge's chart panel shows them. Filter blocks chart only the kept four; a saved filter view naming a cut chart shows its cards. The zero-row, land-tile, and tag-folding items went with their blocks.
- Color by mana value and Power and toughness share a row (7 and 5 of 12 columns). When a block wraps to the next row, the block before it stretches to fill the row, so 900px stacks both full width. Stored layouts keep their key; removed blocks drop out and the grid compacts.
- Page height at 1440px: about 5,000px to about 3,000px.
- E2E drives the kept blocks: counts through the Creatures tile, drill-down and save-as-filter through the power and toughness table.
