---
id: T-065
title: Compare cubes
status: doing
---

Compare the open cube with other cubes, such as ones imported from Cube Cobra ([T-059](T-059-import-export-formats.md)) into their own [cube folders](../GLOSSARY.md#cube-folder) ([T-057](T-057-multiple-cubes.md)) (user, 2026-11-16).

## Decisions (user, 2026-11-16)

- **Mainly one against one**, with room for many against many.
- **Stat deltas first**: every chart Forge and Insights draw, read side by side or as a difference. A card's worth depends on the cube around it, so the shape of each cube matters more than its card list.
- **Tags count as stats**: tag counts and shares sit with the charts.
- **Shared cards second**: which cards the cubes have in common and which only one has. Wanted, but not the main job.
- **One against one in Forge**: the other cube is Forge's faint baseline, the way filters draw one today and [T-055](T-055-forge-overlay.md) plans for other states of this cube. Many against many gets its own view.
- **Many against many**: each cube against the group's average.
- **Scope**: draft only by default; a toggle adds prospects and cut cards.
- **Shares by default**: percent of the scope, with a toggle to counts.
- **Unmatched tags**: listed per cube. Mapping one cube's tag to another's can come later.

## Notes

- **Sizes differ**: cubes of 360, 455, and 540 cards don't compare by raw count, hence shares by default.
- **Tags are per cube**: each cube names its own tags. [Function](../GLOSSARY.md#function) tags are the same everywhere, since imports add them from Scryfall, so they compare directly. Other tags match by name only, or not at all.
- **One open cube**: the server serves one cube at a time ([T-057](T-057-multiple-cubes.md)), so it needs a read-only way to load stats for the other cubes on the recent list.
- **Shared cards**: match by Oracle id, not printing.

## Done when

- Forge draws another cube on the recent list as its baseline on every chart and tag count, in shares or counts, with the scope toggle, with e2e coverage.
- A many-cube view compares each picked cube with the group's average.
- Shared and unique cards between two cubes are listed.
