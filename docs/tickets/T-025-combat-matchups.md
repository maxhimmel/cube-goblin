---
id: T-025
title: Combat matchups
status: doing
---

Show how the cube's creatures fare against each other in combat (user, 2026-11-10).

## Decisions (2026-11-10)

- A scatter in Insights: one dot per power/toughness, sized by how many creatures share it. x is the share of the cube's creatures it kills in combat (its power at least their toughness), y the share it survives (their power below its toughness). Lines at 50% split four corners: wins most fights, walls, glass cannons, chump blockers.
- It counts the creatures in the scope picker, leaving out `*` and 0/0 bodies, like Creature balance. Keywords (first strike, deathtouch, flying) are not modeled.
- Hover lists the creatures; click opens them in the bucket panel.
- It reads as a quadrant view, not an x/y plot (user, 2026-11-10): each corner is tinted in its color with an uppercase title and a hint, in the same style as the heatmap's axis titles; no gridlines.
- Dots that sit on top of each other fan out when the pointer comes near, each with a line back to its real spot, and close when it moves away. Dots glide open and shut on a spring (TanStack `motion()` renderer, keyed by body); reduced-motion users get no animation.

## Done when

- The chart shows on Insights in light and dark mode and the user has seen it.
