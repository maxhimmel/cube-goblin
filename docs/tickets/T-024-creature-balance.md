---
id: T-024
title: Creature balance
status: done
---

The user wants a gist of how creatures will interact, what the power level is, and how games could be paced (user, 2026-11-10).

## Decisions (2026-11-10)

- A Creature balance block in Insights: tiles for creature count, typical body, stats per mana (power + toughness ÷ mana value, free creatures skipped), most powerful, toughest, biggest, and smallest, each with name and numbers. A table by mana value gives count, typical body, smallest, and biggest.
- Everything compares against this cube, not an outside "fair rate". "Typical" is the median, so one huge creature like Koma can't skew it.
- The graphic (picked from mockups, user 2026-11-10): x is mana value, y is power + toughness. One dot per creature (hover names it, click opens it), a band for the middle half (25th to 75th percentile) of each mana value, a faint full range, and a line through the medians. Dots are colored by where they sit: above the middle half (big for the mana value), inside it, or below it (small). Tukey outliers (beyond 1.5 times the band's height) also get their names. The open card gets a ring. The tooltip follows the hover and never pins (user, 2026-11-10).
- Later idea, not built: power against toughness for combat matchups, and evasion per mana value.
- Biggest and smallest go by power + toughness, then power, then the cheaper card counts as bigger.
- Creatures with `*` or printed 0/0 (they grow with counters or copy something) count as creatures but stay out of averages and extremes.
- Names open the card pane.

## Done when

- The block shows on Insights and in the share doc, follows the scope picker, and the user has seen it.
