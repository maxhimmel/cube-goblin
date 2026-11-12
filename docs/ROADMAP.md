# Roadmap

This file is the order of work and the session handoff. Each ticket is a file in [tickets/](tickets/) with its own scope and "done when" criteria. `pnpm check` keeps this file and the tickets in sync. `pnpm handoff` says whether the session is safe to close.

## Handoff

- **Updated**: 2026-11-12
- **State**: `main` has the editing workbench and share doc; each view and the ticket behind it are in [views.md](design/views.md), and what each ticket built is in its Built notes under Done. Latest: the change log `#/log` with a stats timeline and folded canceling runs ([T-038](tickets/T-038-change-log.md), [T-039](tickets/T-039-stats-timeline.md)). Commits run fast staged-file checks and merges run the full `pnpm check`; e2e tests are independent and parallel ([session-timing.md](research/session-timing.md)). Known gaps: [T-042](tickets/T-042-known-gaps.md). Project skills in `.claude/skills/` (workbench testing, shipping, React pointer input) hold repeated lessons, each with an eval.
- **Next step**: Ask the user how the stats timeline reads once their log has a few entries (their server on 5173 needs a restart to load it). Then T-041, T-040, T-034, and T-026. Still waiting on feedback for `#/tags` and `#/versions`.

## Now

## Next

- [T-034: Persistence audit](tickets/T-034-persistence-audit.md)
- [T-026: Compare cards and groups](tickets/T-026-compare-cards-and-groups.md)
- [T-041: Change log in the share doc](tickets/T-041-change-log-in-share-doc.md)
- [T-040: Change log from git history](tickets/T-040-change-log-from-git.md)

## Later

- [T-042: Known gaps](tickets/T-042-known-gaps.md)
- [T-033: Hide empty](tickets/T-033-hide-empty.md)
- [T-002: Trim draft to target size](tickets/T-002-trim-draft-to-target.md)
- [T-005: Synergy and combo map](tickets/T-005-synergy-and-combo-map.md)
- [T-006: Share doc polish](tickets/T-006-share-doc-polish.md)
- [T-007: Winston draft simulator](tickets/T-007-winston-simulator.md)

## Done

- [T-039: Stats timeline](tickets/T-039-stats-timeline.md)
- [T-038: Change log](tickets/T-038-change-log.md)
- [T-037: Try several moves at once in the Lab](tickets/T-037-lab-scenario.md)
- [T-036: Lab creature charts](tickets/T-036-lab-creature-charts.md)
- [T-032: Unlimited sort chain](tickets/T-032-sort-chain.md)
- [T-035: Lab-native charts](tickets/T-035-lab-insights-blocks.md)
- [T-031: Lab view](tickets/T-031-lab-view.md)
- [T-028: Filter query syntax](tickets/T-028-filter-query-syntax.md)
- [T-030: Lab spike](tickets/T-030-lab-spike.md)
- [T-027: Filter widgets on Insights](tickets/T-027-filter-widgets.md)
- [T-029: Remember view choices](tickets/T-029-remember-view-choices.md)
- [T-014: Versions and compare](tickets/T-014-versions-and-compare.md)
- [T-013: Mechanic detection wizard](tickets/T-013-mechanic-detection-wizard.md)
- [T-012: Tag overlap view](tickets/T-012-tag-overlap-view.md)
- [T-009: Archive and delete cards](tickets/T-009-archive-and-delete.md)
- [T-023: Several tags per Board section](tickets/T-023-section-tags.md)
- [T-022: Functions as tags](tickets/T-022-functions-as-tags.md)
- [T-025: Combat matchups](tickets/T-025-combat-matchups.md)
- [T-024: Creature balance](tickets/T-024-creature-balance.md)
- [T-021: Creature power and toughness](tickets/T-021-creature-power-toughness.md)
- [T-020: Color presence and heavy pips](tickets/T-020-color-presence-and-heavy-pips.md)
- [T-019: Card types overlap](tickets/T-019-card-types-overlap.md)
- [T-018: Sections on the Board](tickets/T-018-sections-on-the-board.md)
- [T-017: Choose a card's printing](tickets/T-017-card-printings.md)
- [T-011: Board view](tickets/T-011-board-view.md)
- [T-015: Insights dashboard layout](tickets/T-015-insights-dashboard-layout.md)
- [T-016: Insights drill-down](tickets/T-016-insights-drill-down.md)
- [T-004: Stats and charts](tickets/T-004-stats-and-charts.md)
- [T-001: Editing workbench](tickets/T-001-editing-workbench.md)
- [T-003: Visual design pass](tickets/T-003-visual-design-pass.md)
- [T-008: React hooks lint rules](tickets/T-008-react-hooks-lint.md)
- [T-010: Per-card Scryfall cache](tickets/T-010-per-card-scryfall-cache.md)
