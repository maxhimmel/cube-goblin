# Workbench views

How the workbench is laid out, by what the user is doing. Agreed with the user on 2026-11-09. Each view is built under the ticket named in its row.

## One workspace

Every view shares a top bar (view switcher, filter, draft count against the target in `cube.config.json`) and the same card strip. A card opens in a detail pane that slides in from the right over any view and keeps its own URL, so there is no separate card page.

| Job                             | View                                                                                                                                                                                                                          | Ticket                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Balance the draft               | **Wall**: columns by mana value, color, or card type, optional rows by color or card type. Counts sit in the column heads.                                                                                                    | [T-003](../tickets/T-003-visual-design-pass.md)       |
| See prospects next to the draft | **Prospects tray** docked under every view, with the Wall's columns. Dragging a card between draft and tray changes its status.                                                                                               | [T-003](../tickets/T-003-visual-design-pass.md)       |
| Scan card images, bulk edit     | **Cards** (`/cards`): the image grid, organized by status or tag, with multi-select and a bulk bar. Its numbers live in Insights.                                                                                             | [T-001](../tickets/T-001-editing-workbench.md)        |
| Inspect or edit a card          | **Detail pane**.                                                                                                                                                                                                              | [T-003](../tickets/T-003-visual-design-pass.md)       |
| Sketch groups before tagging    | **Board** (`/board`, workbench only): a grid of [sections](../GLOSSARY.md#section) to drag cards into, next to a pool of draft and prospect cards.                                                                            | [T-011](../tickets/T-011-board-view.md)               |
| Explore tag overlaps            | **Tags** (`/tags`): pick tags; a Venn diagram for two or three, and a matrix of every [overlap](../GLOSSARY.md#overlap). One filters the Wall.                                                                                | [T-012](../tickets/T-012-tag-overlap-view.md)         |
| Read the numbers                | **Insights** (`/insights`): counts and charts for a scope (draft, draft + prospects, all, or the Cards selection), plus saved [filters](../GLOSSARY.md#filter) as blocks. Any block can be hidden. The share doc gets it too. | [T-004](../tickets/T-004-stats-and-charts.md)         |
| Compare versions                | **Versions** (`/versions`, workbench only): save a [version](../GLOSSARY.md#version) and compare two, or one with the current cube.                                                                                           | [T-014](../tickets/T-014-versions-and-compare.md)     |
| Tune with live stats            | **Lab** (`/lab`, workbench only): cards in contention, charts, and filter blocks in one layout; filters dim or hide cards and redraw charts against a faint baseline.                                                         | [T-031](../tickets/T-031-lab-view.md)                 |
| Compare cards and groups        | **Compare**: side by side.                                                                                                                                                                                                    | [T-026](../tickets/T-026-compare-cards-and-groups.md) |

## The card at a glance

Wherever cards are stacked or small, each one shows its name, mana cost, and color without a hover. On desktop, hovering shows the whole card; on touch, a tap opens the detail pane.

## Card types

The type list lives in `TYPE_COLUMNS` (`packages/cube/src/stats.ts`). A card shows under every type on its front face, so an Artifact Creature sits in both the Artifact and the Creature columns ([T-019](../tickets/T-019-card-types-overlap.md)). Sorting uses the first match only. Mechanic groups such as "makes tokens" are [function](../GLOSSARY.md#function) tags ([T-022](../tickets/T-022-functions-as-tags.md)), not Wall columns.

## Look

Palette from the binder direction (navy pages, violet accent); cards lift and tilt on hover. Screenshots of the three explored directions are not kept; the CSS that ships is the source of truth.
