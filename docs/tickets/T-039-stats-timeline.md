---
id: T-039
title: Stats timeline
status: done
---

A timeline of the cube's stats (draft count, curve, colors, card types, [functions](../GLOSSARY.md#function), …) drawn from the [change log](T-038-change-log.md)'s entries, shown next to the entries so each edit's effect on balance is visible over time (user, 2026-11-12: "a chart snapshot timeline in conjunction with the edits").

## Sketch

- Each log entry already stores the stats after it ([T-038](T-038-change-log.md)); the timeline plots them by entry, with the entry's subject on hover and a click that scrolls the log to it.
- Pick which stats to plot; mark entries with a message (the "why") differently from bare moves.
- X-axis: one even step per entry, oldest left (user, 2026-11-12: entries, not time).

## Built (2026-11-12)

- `apps/web/src/log/timeline.tsx` (chart and picker), `timeline-model.ts` (points, stat options, colors). Sits at the top of `LogView`, sticky on screens at least 720px tall (entries keep a scroll margin of its height), so T-041's share doc gets it too.
- Stat groups follow the log's trailers (Counts, Curve, Colors, Types, Tags); checkboxes pick any stats across groups (default `draft`), remembered in view state `log.timeline.stats`. All/None set a whole group; dragging across checkboxes paints them on or off, Shift-click sets a range, Alt-click keeps only that stat (user, 2026-11-12: too many toggles). Colors draw in mana colors, the rest in the chart palette. The y-axis fits the plotted values, not zero. Change mode (the default, `log.timeline.mode`) plots each stat minus its value at the first entry, so stats of any size share a ±0 line and small moves show (user, 2026-11-12: the chart looked flat); Values plots raw numbers. The tooltip shows both.
- Filled dots mark entries with a why, hollow dots bare moves; hover shows subject and value. Clicking a dot highlights and scrolls to its entry (clearing a log filter that hides it); hovering or focusing an entry draws a rule at its step until the pointer or focus leaves.
- Known gaps: no point before the first entry (entries store stats after only).

## Done when

- `#/log` shows the timeline for the chosen stats, linked both ways with the entries, covered by unit and e2e tests.
