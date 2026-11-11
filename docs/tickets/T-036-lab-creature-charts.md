---
id: T-036
title: Lab creature charts
status: done
---

Creature balance ([T-024](T-024-creature-balance.md)) and combat matchups ([T-025](T-025-combat-matchups.md)) are the last Insights blocks in the [Lab](../GLOSSARY.md#lab) dock. They were laid out for a 12-column Insights row, so they read poorly in a slim dock tile, and they don't peek, pin, draw a baseline, or show ghost deltas like the Lab's own charts ([T-035](T-035-lab-insights-blocks.md)). The user wants bespoke Lab versions, not just the interactivity (2026-11-11).

## Scope

- A compact creature balance chart: per mana value, the creatures' size against the cube's typical size, readable in a 300 px tile and in a side dock.
- A compact combat matchups chart with the same quadrant meaning as T-025, sized for a tile.
- Both peek on hover, add a pill on click (or within the chart), follow or pin a scope, draw the baseline, and show ghost deltas for hovered, dragged, and opened cards.
- Once they exist, the Lab drops `chartBlock` and the Insights blocks entirely.

## Built (2026-11-11)

- Creature balance (`BalanceStrips`, `balanceRows` in `apps/web/src/lab/`): one strip per mana value, with the scope's full range, middle half, and median, and one dot per body colored above, within, or below the middle half. A row peeks and picks the new `creatureCurve:<mv>` bucket ("Creatures · MV 2", query `t:creature mv=2`). Arriving and leaving bodies show as rings; the row count gets the ghost delta.
- Combat matchups (`CombatPlot`, `matchups`): the T-025 quadrants with corner titles and counts (with ghost deltas) outside the plot. Each body is scored against the scope's creatures, not the filter, so a peek or a move never moves a dot. A dot peeks and picks its `body:P:T` bucket.
- The Lab drops `chartBlock` and the Insights blocks; saved dock settings move `creature-balance` and `combat` to `lab:balance` and `lab:combat`.
- Quadrant columns are `minmax(0, 1fr)`, so a wider count ("12/27 +1") can't resize the plot (user saw it jitter on peeks and dot picks).

## Done when

- Both charts work in a top and a side dock, with e2e coverage of a peek and a ghost delta on each.
