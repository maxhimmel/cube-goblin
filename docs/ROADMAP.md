# Roadmap

This file is the order of work and the session handoff. Each ticket is a file in [tickets/](tickets/) with its own scope and "done when" criteria. `pnpm check` keeps this file and the tickets in sync. `pnpm handoff` says whether the session is safe to close.

## Handoff

- **Updated**: 2026-11-08
- **State**: `main` has the monorepo, CLI, first batch (143 cards), share doc, roadmap, and T-001 slices 1–3. `pnpm dev` runs the workbench on live `cube/cards` data. The card page edits status, section, tags, and notes with auto-save and undo. Tags come from `cube/tags.json` (kinds `archetype`/`group`, labels unique ignoring case; `pnpm check` rejects card tags outside it). New tags need an explicit "Create as …"; `#/tags` renames tags and changes their kind. The vocabulary is still empty. Deferred to [T-003](tickets/T-003-visual-design-pass.md): combobox keyboard navigation for the tag picker. Known minor gaps: a failed notes save keeps the draft until blur; only notes flush on tab close. Design notes: [rendering-and-sharing.md](research/rendering-and-sharing.md#workbench-dev-server-2026-11-08).
- **Next step**: [T-001](tickets/T-001-editing-workbench.md) slice 4 (bulk + organize: multi-select in the grid to set status or tags on many cards; group the grid by status, section, or any tag). TanStack Table/Virtual may fit here.

## Now

- [T-001: Editing workbench](tickets/T-001-editing-workbench.md)

## Next

- [T-002: Trim draft to target size](tickets/T-002-trim-draft-to-target.md)
- [T-003: Visual design pass](tickets/T-003-visual-design-pass.md)
- [T-004: Stats and charts](tickets/T-004-stats-and-charts.md)
- [T-008: React hooks lint rules](tickets/T-008-react-hooks-lint.md)

## Later

- [T-005: Synergy and combo map](tickets/T-005-synergy-and-combo-map.md)
- [T-006: Share doc polish](tickets/T-006-share-doc-polish.md)
- [T-007: Winston draft simulator](tickets/T-007-winston-simulator.md)

## Done

- None yet.
