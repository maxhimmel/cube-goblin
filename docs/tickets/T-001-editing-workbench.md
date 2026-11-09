---
id: T-001
title: Editing workbench
status: doing
---

Edit the cube in a local web app instead of hand-editing JSON. Edits save to `cube/cards/*.json`, so git history is the edit log. Goals: [VISION.md](../VISION.md).

## Known so far

- The local app is `apps/web` (`pnpm dev`). It's the same app as the share doc, but a different mode. Background: [rendering-and-sharing.md](../research/rendering-and-sharing.md).
- Card files follow `cardEntrySchema` in `packages/cube/src/schema.ts`: status (`draft` / `prospect` / `cut`), section, tags, notes.
- Saving needs a dev-only write endpoint, since the browser can't write repo files itself. Plan: a small Vite dev-server plugin, not TanStack Start (the reasons are in the research doc).

## Decisions (user, 2026-11-08)

- **Edits wanted**: status changes, notes, tags and archetypes, adding and swapping cards, plus stats/infographics and organizing views. The stats overlap [T-004](T-004-stats-and-charts.md): this ticket ships basic counts, T-004 does the full charts.
- **Bulk and single**: both. Edit one card in detail, or multi-select in the grid.
- **Groups**: user-made and non-exclusive, so one card can sit in many groups. Modeled as tags with a kind (`archetype` or `group`), all in one vocabulary file. The grid can be organized by any group.
- **Saving**: auto-save. Every change writes the card file immediately, with an undo toast. Git commits stay a separate, deliberate step.
- **Tags**: picked from a fixed list kept in a vocabulary file. "Add new" is an explicit action, so names stay consistent.

## Decisions (user, 2026-11-09)

- **Added cards' source**: each add appends a `[  ] Name` line to `cube/inbox/workbench.txt`, and the card's `source` points at that line.
- **Swap**: never deletes. The old card becomes `cut` and keeps its notes. Copying its tags to the new card is a choice made on each swap. Deletion and an archive are [T-009](T-009-archive-and-delete.md).
- **Status of an added card**: picked on each add (prospect selected by default; a swap starts from the old card's status and section).

## Slices (each one is a branch merged with `--no-ff`)

1. **Write API + live data**: dev-only endpoints that read the cube and Scryfall data and validate writes with zod. The workbench shows live data instead of the snapshot, and the share doc stays read-only.
2. **Single-card editing**: status, notes, and tags on the card page, with auto-save and undo.
3. **Tag vocabulary**: a vocabulary file and a check that every card tag is in it. Create, rename, and pick tags in the UI.
4. **Bulk + organize**: multi-select in the grid and set status or tags on many cards. Group the grid by status, section, or any tag.
5. **Add and swap**: search Scryfall through the dev server (cached and rate-limited) to add a card, or swap one for another while keeping its notes and tags.
6. **Basic stats**: counts by status, color, mana value, and tag, shown next to the grid.

## Done when

- Every slice above is merged, and the user has tried the workbench.
- Each slice has e2e coverage of an edit landing on disk, and `pnpm check` passes.
