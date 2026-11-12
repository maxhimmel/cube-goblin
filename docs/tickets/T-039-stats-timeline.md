---
id: T-039
title: Stats timeline
status: todo
---

A timeline of the cube's stats (draft count, curve, colors, card types, [functions](../GLOSSARY.md#function), …) drawn from the [change log](T-038-change-log.md)'s entries, shown next to the entries so each edit's effect on balance is visible over time (user, 2026-11-12: "a chart snapshot timeline in conjunction with the edits").

## Sketch

- Each log entry already stores the stats after it ([T-038](T-038-change-log.md)); the timeline plots them by entry, with the entry's subject on hover and a click that scrolls the log to it.
- Pick which stats to plot; mark entries with a message (the "why") differently from bare moves.
- Ask the user whether the x-axis is entries or time.

## Done when

- `#/log` shows the timeline for the chosen stats, linked both ways with the entries, covered by unit and e2e tests.
