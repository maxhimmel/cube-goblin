# Roadmap

This file is the order of work and the session handoff. Each ticket is a file in [tickets/](tickets/) with its own scope and "done when" criteria. `pnpm check` keeps this file and the tickets in sync. `pnpm handoff` says whether the session is safe to close.

## Handoff

- **Updated**: 2026-11-08
- **State**: `main` has the monorepo, CLI, first batch (143 cards), share doc, roadmap, and T-001 slice 1. `pnpm dev` runs the workbench on live `cube/cards` data with a dev-only, validated write API (`PUT /api/cards/:slug`), serialized and atomic. It has no edit UI yet. Design notes and the experimental `configLoader: "runner"` gotcha: [rendering-and-sharing.md](research/rendering-and-sharing.md#workbench-dev-server-2026-11-08).
- **Next step**: [T-001](tickets/T-001-editing-workbench.md) slice 2 (single-card editing: status, notes, tags on the card page with auto-save and undo), built on the existing PUT endpoint and TanStack Query mutations.

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
