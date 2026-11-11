---
id: T-036
title: Lab creature charts
status: todo
---

Creature balance ([T-024](T-024-creature-balance.md)) and combat matchups ([T-025](T-025-combat-matchups.md)) are the last Insights blocks in the [Lab](../GLOSSARY.md#lab) dock. They were laid out for a 12-column Insights row, so they read poorly in a slim dock tile, and they don't peek, pin, draw a baseline, or show ghost deltas like the Lab's own charts ([T-035](T-035-lab-insights-blocks.md)). The user wants bespoke Lab versions, not just the interactivity (2026-11-11).

## Scope

- A compact creature balance chart: per mana value, the creatures' size against the cube's typical size, readable in a 300 px tile and in a side dock.
- A compact combat matchups chart with the same quadrant meaning as T-025, sized for a tile.
- Both peek on hover, add a pill on click (or within the chart), follow or pin a scope, draw the baseline, and show ghost deltas for hovered, dragged, and opened cards.
- Once they exist, the Lab drops `chartBlock` and the Insights blocks entirely.

## Done when

- Both charts work in a top and a side dock, with e2e coverage of a peek and a ghost delta on each.
