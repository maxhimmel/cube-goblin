---
id: T-004
title: Stats and charts
status: done
---

Cube statistics: color balance, mana curve, card types, removal and fixing density, and section/archetype counts. They live in the Insights view and the Wall's column heads ([views.md](../design/views.md)). Load the `dataviz` skill before writing any chart.

## Done when

- The agreed stats render in the workbench, update as the cube is edited, and come from the snapshot data (no hardcoded numbers).

## Decisions (user, 2026-11-09)

- **Stats**: color balance, mana curve, card types, archetype/group counts, plus removal and fixing.
- **Removal and fixing**: from Scryfall's community oracle tags, cached on disk so they work offline ([oracle-tags.md](../research/oracle-tags.md)). Scryfall has no fixing tag, so fixing is the `fetchland` tag plus cards that make two or more colors ([Glossary: Function](../GLOSSARY.md#function)).
- **Charts**: TanStack (`@tanstack/charts`), per the user's ask ([tooling.md](../research/tooling.md#charts-2026-11-09)).

## What shipped

`#/insights` in the workbench and the share doc: stat tiles, the draft gauge, and charts for mana curve, color, color by mana value (heatmap), mana symbols, card types, functions, sections, archetypes, and groups. Each chart has a table view. A scope picker counts the draft, draft + prospects, all cards, or the Cards selection (workbench only). Bars use one hue (the accent); the heatmap is a six-step ramp of it, with label ink picked per step and mode for at least 4.28:1 contrast. The Cards stats panel is gone.
