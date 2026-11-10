---
id: T-020
title: Color presence and heavy pips
status: done
---

The Mana symbols chart counts raw pips, which says little (user, 2026-11-10).

## Decisions (user, 2026-11-10)

- Replace Mana symbols with Color presence: each color counts every card of that color, and multicolored cards also count as Multicolored. Aerid Konstrari counts once in Multicolored, Green, and Red.
- Presence lives inside the Color chart, not in its own block: each color's bar stacks mono cards (solid) and multicolored cards with that color (a paler tint of the same color). Counts sit inside each part, and the total sits at the end of the bar, with no sum written out. Clicking a part lists its cards; clicking the color's name lists all of them.
- Add Heavy pips: per color, the cards whose mana cost has two or more pips of that color.
- Chart tooltips go: they covered neighboring bars, and every bar already shows its count. The hover focus dot goes too, because it hid the counts.

## Done when

- Both charts show in Insights with a table view and drill-down, and the share doc shows them too.
