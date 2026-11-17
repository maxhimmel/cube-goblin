---
id: T-065
title: Compare cubes
status: done
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

## Built (2026-11-16)

- **Logic** (`packages/cube/src/compare.ts`): tags match by label or id, ignoring case and separators (`matchTags`, `translateTags`); unmatched ones are counted per cube. `poolTags` merges by label or id the same way. `cardOverlap` splits cards by Oracle id. `scaled` sizes another cube's count to this one. `poolTags` and `groupAverage` give each cube's share of a row and its distance from the mean share.
- **Server**: `GET /api/cubes/cards?dir=` reads a cube on the recent list without opening it (`CubeLibrary.cards`, `WorkbenchServer.peek`).
- **Forge**: a Compare menu beside Blocks picks a cube and Scaled or Counts. The other cube's cards follow each block's scope menu (draft, draft plus prospects, or all), so both sides count the same pool; the Cubes view has its own toggle. Every chart marks the other cube's number (a teal tick on bars, "vs N" on values, arrows on Color × mana value), and the creature balance rows tick its median. Tags list the other cube's unmatched tags. A Shared cards block lists cards in both and only in one. The choice is remembered per cube (`forge.compare`). Workbench only.
- **Cubes view** (`#/cubes`, workbench only): picks any cubes from the switcher's list. A Summary on top gives one line on the biggest gap, a card per cube (size, creature and land shares, average mana value, color mix), and the five stats that stand out most (`standouts`). Below, Curve, Color, Card types, Heavy pips, and pooled Tags each get a section that names its biggest gaps and a matrix with mana-font row icons, one column per cube plus the average; cells 5+ points off the average are outlined and badged, 10+ filled. Each section draws a grouped bar chart by default (a bar per cube in the categorical palette validated with the dataviz skill's checker, a tick at the average, a legend for both, value labels on every bar since some colors sit under 3:1 on the light panel) and switches to its table (user, 2026-11-16: "turn these into bar charts"). Tags past the top ten that sit near the average fold behind a button (user, 2026-11-16: the first table version was "pretty boring").
- **Fixture**: `apps/web/e2e/fixture/rival`, a 14-card cube that shares 6 cards with the main fixture and uses its own tag ids. e2e: both views in `cubes.spec.ts`.
- **Gaps**: Power × toughness has no compare mark (its dots are cards). Mapping one cube's tag to another's is not built. The other cube's cards are cached for a minute, so edits made to it from another window show late.
