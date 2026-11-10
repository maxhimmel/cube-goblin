---
id: T-024
title: Creature balance
status: doing
---

The user wants a gist of how creatures will interact, what the power level is, and how games could be paced (user, 2026-11-10).

## Decisions (2026-11-10)

- A Creature balance block in Insights: tiles for creature count, average body, stats per mana (power + toughness ÷ mana value, free creatures skipped), and the biggest and smallest creature with name and numbers. A table by mana value gives count, average body, smallest, and biggest.
- Biggest and smallest go by power + toughness, then power, then the cheaper card counts as bigger.
- Creatures with `*` or printed 0/0 (they grow with counters or copy something) count as creatures but stay out of averages and extremes.
- Names open the card pane.

## Done when

- The block shows on Insights and in the share doc, follows the scope picker, and the user has seen it.
