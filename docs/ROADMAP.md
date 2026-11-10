# Roadmap

This file is the order of work and the session handoff. Each ticket is a file in [tickets/](tickets/) with its own scope and "done when" criteria. `pnpm check` keeps this file and the tickets in sync. `pnpm handoff` says whether the session is safe to close.

## Handoff

- **Updated**: 2026-11-10
- **State**: `main` has the monorepo, CLI, first batch (143 cards; the one-time inbox batches are deleted, and cards now come in through `#/add`), share doc, roadmap, and all six T-001 slices. `pnpm dev` runs the workbench on live `cube/cards` data. Layout and look follow [views.md](design/views.md) (T-003): the home view is the Wall (columns by mana value, color, or card type; card strips show name, cost, and color; hover shows the whole card), with a draft-size gauge and a prospects tray; dragging a strip between them changes its status. `?card=<slug>` opens a slide-in detail pane over any view (`#/card/<slug>` redirects to it; opening or closing the pane, or an Insights bucket, passes `resetScroll: false` so the page keeps its scroll position); the pane edits status, tags (keyboard combobox), and notes with auto-save and undo. Cards have no section field any more (T-018); the 27 that had one end their notes with `Deck: <name>`. Tags come from `cube/tags.json` (kinds `archetype`/`group`); `#/tags` renames tags and changes their kind. The vocabulary is still empty. The image grid lives at `#/cards`, with "Organize by" (`?by=`) and checkbox multi-select with a bulk bar (status, add/remove tag, one undo). `#/add` searches Scryfall (full search syntax) and adds a card; `#/add?replaces=<slug>` (the "Swap for another card…" link) swaps one: the old card becomes cut and keeps its notes, and tags copy if you tick the box. Adds append a line to `cube/inbox/workbench.txt`, which the card's `source` points to. `#/insights` (T-004, also in the share doc) shows stat tiles, the draft gauge, and `@tanstack/charts` charts (pinned 1.5.0): mana curve, color, color by mana value, mana symbols, card types, functions (removal, board wipe, counterspell, ramp, draw, fixing), and tags, each with a table view, for draft / draft+prospects / all / selected cards. Color charts wear mana colors, other charts one palette hue each, and the heatmap is a blue ramp with mana-value symbols (user asked for less purple, 2026-11-09). Blocks drag, resize, and collapse ([T-015](tickets/T-015-insights-dashboard-layout.md), layout in localStorage), and clicking a bar, cell, or table row lists that bucket's cards in a side panel ([T-016](tickets/T-016-insights-drill-down.md), `?bucket=`). `#/board` (T-011, workbench only) holds [sections](GLOSSARY.md#section) in `cube/board.json` (called bins until [T-018](tickets/T-018-sections-on-the-board.md)): drag draft and prospect cards from the pool (name filter, Both / Draft / Prospects switch) into sections, with a hint bar across the board for the gestures; pool and bin cards line up (fixed header rows plus subgrid, checked in e2e), and "Sort cards by … then …" (`?sort=`) orders every section and the pool without touching saved order. Each card shows a chosen [printing](GLOSSARY.md#printing) (T-017): the caption under the pane's image opens a browser of every paper printing (`GET /api/cards/:slug/printings`, kept in server memory; thumbnails straight from Scryfall's CDN). The chosen printing's data and images are cached on disk and served stale offline; `pnpm cube pin-printings` pinned all cards to what they showed on 2026-11-10, and the user's later picks in the browser are committed as `chore(cube)` data. The user has started sketching sections; their `cube/board.json` edits are committed as data (`chore(cube)` commits) (a card can sit in several), and "Make tag" adds a section's tag to its cards as one undoable edit; the section stays linked to the tag. The server drops board cards and tags that no longer exist. The workbench writes `cube/cards`, `cube/tags.json`, and `cube/board.json` itself, so prettier skips them. Functions come from Scryfall oracle tags, cached daily in `.cache/scryfall/oracle-tags.json` and served stale when offline ([oracle-tags.md](research/oracle-tags.md)). Card images come from a local disk cache (`/api/image`; [rendering-and-sharing.md](research/rendering-and-sharing.md#workbench-dev-server-2026-11-08)) and fall back to the card name. Mana costs render with the Mana font ([mana-font.md](research/mana-font.md)); the share doc inlines only woff2 fonts (about 3.4 MB in total). Palette: binder navy with a violet accent, Rubik (Latin subset only, inlined in the share doc). Decisions: [T-001](tickets/T-001-editing-workbench.md#decisions-user-2026-11-09), [T-003](tickets/T-003-visual-design-pass.md#decisions-user-2026-11-09). `eslint-plugin-react-hooks` recommended rules lint every package, and `lint` fails on any warning ([tooling.md](research/tooling.md#gotchas)). Scryfall card data is cached per oracle id (`ScryfallClient.byOracleIds`), so an add fetches only the new card. E2E runs in Chromium only (user, 2026-11-09). A change on disk during the first page load used to be dropped (the intermittent "write API" e2e failure); the workbench now cancels and refetches. Known gaps: a cut card shows "In cube" in search and comes back by changing its status, not by re-adding; Scryfall `reversible_card` layouts (no top-level oracle id) don't show in search; tag-removal undo re-appends the tag at the end; an edit queued behind a failed one keeps an undo built from the failed state; a disk failure mid-write can leave a partial batch or an orphan batch line. Design notes: [rendering-and-sharing.md](research/rendering-and-sharing.md#workbench-dev-server-2026-11-08).
- **Next step**: T-018 is done; ask the user how the Board, printings, and the Insights dashboard feel. Next is [T-012](tickets/T-012-tag-overlap-view.md), then the rest of Next in order; [T-009](tickets/T-009-archive-and-delete.md) needs the user's answers (archiving a card should also handle its Board sections). [T-002](tickets/T-002-trim-draft-to-target.md) is in Later.

## Now

## Next

- [T-012: Tag overlap view](tickets/T-012-tag-overlap-view.md)
- [T-014: Versions and compare](tickets/T-014-versions-and-compare.md)
- [T-009: Archive and delete cards](tickets/T-009-archive-and-delete.md)

## Later

- [T-002: Trim draft to target size](tickets/T-002-trim-draft-to-target.md)
- [T-013: Mechanic detection wizard](tickets/T-013-mechanic-detection-wizard.md)
- [T-005: Synergy and combo map](tickets/T-005-synergy-and-combo-map.md)
- [T-006: Share doc polish](tickets/T-006-share-doc-polish.md)
- [T-007: Winston draft simulator](tickets/T-007-winston-simulator.md)

## Done

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
