---
id: T-065
title: Compare cubes
status: todo
---

Compare the open cube with other cubes, such as ones imported from Cube Cobra ([T-059](T-059-import-export-formats.md)) into their own [cube folders](../GLOSSARY.md#cube-folder) ([T-057](T-057-multiple-cubes.md)) (user, 2026-11-16).

## Decisions (user, 2026-11-16)

- **Mainly one against one**, with room for many against many.
- **Stat deltas first**: every chart Forge and Insights draw, read side by side or as a difference. A card's worth depends on the cube around it, so the shape of each cube matters more than its card list.
- **Tags count as stats**: tag counts and shares sit with the charts.
- **Shared cards second**: which cards the cubes have in common and which only one has. Wanted, but not the main job.

## Notes

- **Sizes differ**: cubes of 360, 455, and 540 cards don't compare by raw count. Charts likely need shares (percent of the scope) as well as counts.
- **Tags are per cube**: each cube names its own tags. [Function](../GLOSSARY.md#function) tags are the same everywhere, since imports add them from Scryfall, so they compare directly. Other tags match by name only, or not at all.
- **One open cube**: the server serves one cube at a time ([T-057](T-057-multiple-cubes.md)), so it needs a read-only way to load stats for the other cubes on the recent list.
- **Reuse**: Forge already draws charts against a faint baseline for filters, and [T-055](T-055-forge-overlay.md) plans ghost deltas for other states of the same cube. Another cube could be one more baseline.
- **Shared cards**: match by Oracle id, not printing.

## Open questions

- Where it lives: a Compare view, a cube picker on Insights, or another cube as Forge's baseline or overlay ([T-055](T-055-forge-overlay.md)). It might merge with [T-026](T-026-compare-cards-and-groups.md).
- Many against many: one chart with a series per cube, a matrix of differences, or how each cube differs from the group's average.
- Scope per cube: draft only, or draft plus prospects. Imported maybeboards land as prospects.
- Counts, shares, or a toggle between them.
- Tags that don't match across cubes: hide them, list them per cube, or let the user map one tag to another.

## Done when

- The user has answered the open questions.
- The open cube and one other cube on the recent list show every Forge and Insights chart and their tag counts side by side or as deltas, with e2e coverage.
- Shared and unique cards between them are listed.
