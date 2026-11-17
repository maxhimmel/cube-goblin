# Roadmap

This file is the order of work and the session handoff. Each ticket is a file in [tickets/](tickets/) with its own scope and "done when" criteria. `pnpm check` keeps this file and the tickets in sync. `pnpm handoff` says whether the session is safe to close.

## Handoff

- **Updated**: 2026-11-16
- **State**: `main` has the editing workbench and share doc; each view and the ticket behind it are in [views.md](design/views.md), and what each ticket built is in its Built notes under Done. Latest: **compare cubes** ([T-065](tickets/T-065-compare-cubes.md)): another cube as Forge.s reference; a Cubes view against the group average. Before that: cross-origin gate ([T-062](tickets/T-062-cross-origin-gate.md)), host parity ([T-061](tickets/T-061-host-parity.md)), import and export ([T-059](tickets/T-059-import-export-formats.md)), offline ([T-058](tickets/T-058-offline.md)), multiple cubes ([T-057](tickets/T-057-multiple-cubes.md)) in the desktop app ([T-056](tickets/T-056-desktop-app.md)). Agents drive the desktop app hidden (`cube:workbench-testing`). Merges run the full `pnpm check`, then `pnpm tidy` ([session-timing.md](research/session-timing.md)). Gaps, incl. e2e flakes: [T-042](tickets/T-042-known-gaps.md). Repeated lessons are skills in the `cube` plugin ([packages/skills](../packages/skills), evals via `pnpm skills:eval`).
- **Polish pass done** ([T-043](tickets/T-043-polish-pass.md)): papercuts ([T-044](tickets/T-044-papercuts.md)), top bar and settings ([T-045](tickets/T-045-top-bar-and-settings.md)), **Forge** at `#/` ([T-046](tickets/T-046-wall-and-lab.md), [T-052](tickets/T-052-forge-polish.md), [T-053](tickets/T-053-forge-charts-polish.md)), one **Tags** view ([T-047](tickets/T-047-tag-workspace.md)), History ([T-048](tickets/T-048-history.md)), Insights cut to the deep charts ([T-049](tickets/T-049-insights-trim.md)), favicon, Forge's look shared by every view (drag stipple and tile actions included), and a dev-only type scale panel ("Aa", bottom left in `pnpm dev`) ([T-050](tickets/T-050-visual-system.md)).
- **Review round trip** ([T-051](tickets/T-051-share-doc-suggestions.md)): reviews carry pending moves; each export saves a version as their base; share top bar has one Review menu.
- **Next step**: [T-064](tickets/T-064-public-repo-and-releases.md) public repo, releases, README; [T-063](tickets/T-063-ship-desktop-app.md), [T-054](tickets/T-054-reviews-view.md), [T-055](tickets/T-055-forge-overlay.md).

## Now

- [T-063: Ship the desktop app to a friend](tickets/T-063-ship-desktop-app.md)
- [T-064: Public repo, releases, and README](tickets/T-064-public-repo-and-releases.md)

## Next

- [T-054: Reviews view](tickets/T-054-reviews-view.md)
- [T-055: Forge overlay](tickets/T-055-forge-overlay.md)
- [T-026: Compare cards and groups](tickets/T-026-compare-cards-and-groups.md)

## Later

- [T-060: Optionally save every printing offline](tickets/T-060-offline-printings.md)
- [T-042: Known gaps](tickets/T-042-known-gaps.md)
- [T-002: Trim draft to target size](tickets/T-002-trim-draft-to-target.md)
- [T-005: Synergy and combo map](tickets/T-005-synergy-and-combo-map.md)
- [T-007: Winston draft simulator](tickets/T-007-winston-simulator.md)

## Done

- [T-065: Compare cubes](tickets/T-065-compare-cubes.md)
- [T-062: Cross-origin gate on every route](tickets/T-062-cross-origin-gate.md)
- [T-061: Host parity](tickets/T-061-host-parity.md)
- [T-059: Import and export other sites' formats](tickets/T-059-import-export-formats.md)
- [T-058: Make a cube available offline](tickets/T-058-offline.md)
- [T-057: Multiple cubes](tickets/T-057-multiple-cubes.md)
- [T-056: Desktop app](tickets/T-056-desktop-app.md)
- [T-006: Share doc polish](tickets/T-006-share-doc-polish.md)
- [T-033: Hide empty](tickets/T-033-hide-empty.md)
- [T-051: Suggestions from the share doc](tickets/T-051-share-doc-suggestions.md)
- [T-050: Visual system and favicon](tickets/T-050-visual-system.md)
- [T-043: Polish pass](tickets/T-043-polish-pass.md)
- [T-049: Insights trim](tickets/T-049-insights-trim.md)
- [T-048: History](tickets/T-048-history.md)
- [T-047: Tag workspace](tickets/T-047-tag-workspace.md)
- [T-053: Forge charts polish](tickets/T-053-forge-charts-polish.md)
- [T-052: Forge polish](tickets/T-052-forge-polish.md)
- [T-046: Merge the Wall and the Lab](tickets/T-046-wall-and-lab.md)
- [T-045: Top bar and settings](tickets/T-045-top-bar-and-settings.md)
- [T-044: Papercuts](tickets/T-044-papercuts.md)
- [T-034: Persistence audit](tickets/T-034-persistence-audit.md)
- [T-040: Change log from git history](tickets/T-040-change-log-from-git.md)
- [T-041: Change log in the share doc](tickets/T-041-change-log-in-share-doc.md)
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
