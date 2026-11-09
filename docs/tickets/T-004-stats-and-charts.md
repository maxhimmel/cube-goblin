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
- **Less purple** (feedback after first look): chart colors vary by chart, and the heatmap columns use mana-value symbols.
- **Charts**: TanStack (`@tanstack/charts`), per the user's ask ([tooling.md](../research/tooling.md#charts-2026-11-09)).

## What shipped

`#/insights` in the workbench and the share doc: stat tiles, the draft gauge, and charts for mana curve, color, color by mana value (heatmap), mana symbols, card types, functions, sections, archetypes, and groups. Each chart has a table view. A scope picker counts the draft, draft + prospects, all cards, or the Cards selection (workbench only). Color and mana-symbol bars wear their mana color; every other chart has one hue of its own from the dataviz reference palette (CSS variables in `apps/web/src/insights/insights.css`). The heatmap is a six-step blue ramp with mana-value symbols on its columns; its label ink is set per step and mode for at least 4.4:1 contrast. The Cards stats panel is gone.
