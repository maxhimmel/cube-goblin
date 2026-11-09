# Roadmap

This file is the order of work and the session handoff. Each ticket is a file in [tickets/](tickets/) with its own scope and "done when" criteria. `pnpm check` keeps this file and the tickets in sync. `pnpm handoff` says whether the session is safe to close.

## Handoff

- **Updated**: 2026-11-09
- **State**: `main` has the monorepo, CLI, first batch (143 cards), share doc, roadmap, and all six T-001 slices. `pnpm dev` runs the workbench on live `cube/cards` data. The card page edits status, section, tags, and notes with auto-save and undo. Tags come from `cube/tags.json` (kinds `archetype`/`group`); `#/tags` renames tags and changes their kind. The vocabulary is still empty. The grid has "Organize by" (`?by=`) and checkbox multi-select with a bulk bar (status, section, add/remove tag, one undo). `#/add` searches Scryfall (full search syntax) and adds a card; `#/add?replaces=<slug>` (the "Swap for another card…" link) swaps one: the old card becomes cut and keeps its notes, and tags copy if you tick the box. Adds append a line to `cube/inbox/workbench.txt`, which the card's `source` points to. A stats panel beside the grid shows the draft count against the target size in `cube.config.json`, plus counts by status, color, mana value (nonland cards) and tag, for draft / draft+prospects / all / selected cards. Card images come from a local disk cache (`/api/image`; [rendering-and-sharing.md](research/rendering-and-sharing.md#workbench-dev-server-2026-11-08)) and fall back to the card name. Mana costs render with the Mana font ([mana-font.md](research/mana-font.md)); the share doc inlines only its woff2 (about 3.4 MB in total). Decisions: [T-001](tickets/T-001-editing-workbench.md#decisions-user-2026-11-09). Deferred to [T-003](tickets/T-003-visual-design-pass.md): tag picker keyboard navigation, tile checkbox size, indeterminate pile checkbox. Known gaps: each add changes the full-cube Scryfall collection cache key, so the next load re-fetches most card data (~0.5s per 75 cards; [T-010](tickets/T-010-per-card-scryfall-cache.md)); a cut card shows "In cube" in search and comes back by changing its status, not by re-adding; Scryfall `reversible_card` layouts (no top-level oracle id) don't show in search; tag-removal undo re-appends the tag at the end; an edit queued behind a failed one keeps an undo built from the failed state; a disk failure mid-write can leave a partial batch or an orphan batch line. Design notes: [rendering-and-sharing.md](research/rendering-and-sharing.md#workbench-dev-server-2026-11-08).
- **Next step**: user-chosen order (2026-11-09): [T-010](tickets/T-010-per-card-scryfall-cache.md), then [T-008](tickets/T-008-react-hooks-lint.md), then [T-003](tickets/T-003-visual-design-pass.md). Meanwhile the user tries the workbench (`pnpm dev`), which closes [T-001](tickets/T-001-editing-workbench.md). Later: [T-002](tickets/T-002-trim-draft-to-target.md) (draft is over target); [T-009](tickets/T-009-archive-and-delete.md) needs the user's answers.

## Now

- [T-001: Editing workbench](tickets/T-001-editing-workbench.md)

## Next

- [T-002: Trim draft to target size](tickets/T-002-trim-draft-to-target.md)
- [T-003: Visual design pass](tickets/T-003-visual-design-pass.md)
- [T-004: Stats and charts](tickets/T-004-stats-and-charts.md)
- [T-008: React hooks lint rules](tickets/T-008-react-hooks-lint.md)
- [T-009: Archive and delete cards](tickets/T-009-archive-and-delete.md)
- [T-010: Per-card Scryfall cache](tickets/T-010-per-card-scryfall-cache.md)

## Later

- [T-005: Synergy and combo map](tickets/T-005-synergy-and-combo-map.md)
- [T-006: Share doc polish](tickets/T-006-share-doc-polish.md)
- [T-007: Winston draft simulator](tickets/T-007-winston-simulator.md)

## Done

- None yet.
