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
- **Cubes view** (`#/cubes`, workbench only; layout picked from mockup round two, direction E, user 2026-11-19): fits one laptop screen. One large radar (TanStack Charts `polar`, `apps/web/src/cubes/radar.tsx`) shows the picked section, with clickable rim labels; a strip below shows every section and Custom as small radars to switch between. The right Inspector shows the hovered spoke (each cube's number, a bar from the average, the gap) over two tabs: Pinned and Biggest gaps (the twelve widest gaps across every stat, each pinnable). Hovering a row highlights its spoke label on the big radar and outlines the strip tiles that hold it; clicking opens its section. Draft/+prospects, Shares/Counts, and Radar/Table sit together in the big chart's header (user, 2026-11-19: no lede; biggest gaps in the panel; consolidate the toggles). Clicking a spoke pins it; pins build the Custom radar, start from the five widest gaps, and are remembered with the section and Radar/Table view. Hovering a cube anywhere highlights it in every radar. Row icons reuse Forge's: mana color symbols on color and heavy-pip rows, and Forge's `curveTick` mana-value symbols on curve spokes (user, 2026-11-19). The inspector's spoke detail sits in its own card above the lists; its tabs use the shared segmented style. The detail card previews the hovered spoke and otherwise rests on the shown chart's biggest gap, with a caption saying which, and what a click does (pin, unpin, or open its section); the Custom tile previews a pin change ("5 pins +1"). Top and bottom rim labels hang away from the radar so section subtitles don't cover it (user, 2026-11-19). Earlier versions (tables, bar charts, stacked radars) were rejected along the way.
- **Hover and morph** (fix, user 2026-11-19): the detail card no longer says what a click does. A rim label shows a small corner badge instead, + in Forge's keep green to pin or − in its cut red to unpin, only while the pointer or focus is on the radar; it overlays the label so nothing shifts. Hovering a panel row highlights the label without the badge. Chart focus can't clear a hovered label, which caused a half-hovered flicker. Clicking a pinned row on Custom opens its section. Every radar outline (cubes, average, grid rings) is resampled to 120 points (`apps/web/src/cubes/outline.ts`), so switching between sections with different spoke counts morphs instead of snapping; hidden dots at the real vertices keep hover and click. Custom's spokes and the Pinned list run in Biggest gaps order, clockwise from the top, whatever order they were pinned in (user, 2026-11-19). The badge's color follows the pinned state, so it doesn't flash green as it fades out. Biggest gaps rows pin with a pushpin: a tilted outline when not pinned, filled when pinned; hover turns it green and presses it in, or red with a slash to unpin. Rim labels use the same pin in a corner badge instead of +/− and the pinned dot. Custom's labels and the Pinned list carry no numbers (user, 2026-11-19: they matched nothing else on screen), and Custom's labels show the pin only on hover, since every spoke there is pinned.
- **Fixture**: `apps/web/e2e/fixture/rival`, a 14-card cube that shares 6 cards with the main fixture and uses its own tag ids. e2e: both views in `cubes.spec.ts`.
- **Loading other cubes** (fix, 2026-11-19): the page sat on "Loading…" with real imports: Scryfall cache entries older than a day were refetched for every compared cube (about 2,000 cards through one 500 ms-spaced queue). Reading another cube now reuses cached cards of any age (`forEntries(entries, "any")`) and fetches only cards never cached, and the page loads other cubes one at a time. Measured in the hidden desktop app on a copy of the user's cache and five cubes: all loaded in 0.4 s.
- **Gaps**: Power × toughness has no compare mark (its dots are cards). Mapping one cube's tag to another's is not built. The other cube's cards are cached for a minute, so edits made to it from another window show late.
