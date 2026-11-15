---
id: T-059
title: Import and export other sites' formats
status: doing
---

Cubes move in and out of other MTG sites and clients (user, 2026-11-15). Research: [cube-formats.md](../research/cube-formats.md) (Cube Cobra, Draftmancer), [deck-list-formats.md](../research/deck-list-formats.md) (MTGO, Arena, Moxfield, Archidekt, MTGGoldfish, Cockatrice, XMage).

## Decisions (user, 2026-11-15)

- Formats: Cube Cobra, Draftmancer, deck text lists (MTGO, Arena, Moxfield, Archidekt, MTGGoldfish), Cockatrice, and XMage.
- A list typed by hand in no known format: the Import tab hands out a prompt (`AI_IMPORT_PROMPT`, `packages/cube/src/formats/ai-prompt.ts`) to paste with the list into any AI chat, and the AI's answer pastes back in. A test keeps the prompt's example readable by the importer. Checked on 2026-11-15: a messy hand-typed list run through `claude -p --model sonnet` imported all 13 cards with none missed.

## Scope

- **One module per format** in `packages/cube` (`formats/<name>.ts`): a pure `parse(text) → ImportRow[]` and `write(cube) → string`, unit tested against the verbatim examples in the research notes.
- **Import**:
  - Sources: a file, pasted text, or a Cube Cobra cube URL or id through `GET /cube/api/cubeJSON/:id`. One request when the user asks, with our User-Agent, backing off on 429.
  - Resolving rows to Scryfall: by printing id when the format has one (cubeJSON `cardID`, Cockatrice `uuid`), then MTGO `CatID` as `mtgo_id`, then set plus collector number, then exact name with front-face fallback. Batched through `/cards/collection`.
  - A preview lists matches, misses (each editable or skippable), and how zones map to statuses.
  - Results land in a new cube ([T-057](T-057-multiple-cubes.md)) or merge into the open one. Merging logs one [change log](../GLOSSARY.md#change-log) entry.
- **Status mapping**: draft ↔ main deck or Cube Cobra mainboard; prospect ↔ sideboard, maybeboard, or Cube Cobra maybeboard; cut ↔ a `cut` board in Cube Cobra and a `Cut{noDeck}` category in Archidekt, and dropped where there's no home. The mapping is shown and can be changed in the import preview.
- **Tags and notes**: kept through Cube Cobra CSV and JSON and Archidekt categories. Formats that can't carry them drop them, and the export dialog says what each format loses.
- **Export**: a menu with every format, writing the right card name for each target (front face for Cube Cobra, Cockatrice, and XMage; `A // B` where it's expected; `A/B` for MTGO .dek). Cube Cobra CSV leaves CMC, Type, Color, and Rarity empty so they don't become overrides. Draftmancer export defaults its settings to a two-player Winston cube sized from the cube's config.
- **Tolerant text parser**: one parser for every plain-text deck-list variant, using the grammar in [deck-list-formats.md](../research/deck-list-formats.md#tolerant-parser). It detects formats by content, not by extension.
- **CLI**: `pnpm cube import <file|url>` and `pnpm cube export --format <name>`. They reuse the same modules.
- **Verify the unverified first**: check the Moxfield and Archidekt syntax against each site's own import dialog before shipping those writers. Their help pages blocked automated fetches.

## Done when

- A cube exported to each format re-imports with the same cards, and the statuses, tags, and notes each format can carry, covered by round-trip tests. Each format has one real file, made by its site or client, that imports cleanly.
- One real Cube Cobra cube imports by URL into a new cube, verified by running it.

## Progress

- **Format modules** (`packages/cube/src/formats/`): parsers and writers for every format, detection by content, and round-trip plus sample-file tests. Moxfield and Archidekt writers checked against real exports the user copied (2026-11-15). Moxfield's sideboard header is still unverified.
- **Resolve and CLI**: `resolveRows` (`packages/cube/src/formats/resolve.ts`) matches by printing id, then `mtgo_id`, set and number, name, and fuzzy name. `planImport` and `applyImport` (`packages/cube/src/import.ts`) map boards to statuses, make missing tags, and skip repeats. `pnpm cube import <file|url> [--new <dir>] [--board b=status]` and `pnpm cube export --format <id> [--out]` work. A merge logs one change log entry.
- **Verified by running** (2026-11-15): Cube Cobra's `thepaupercube` imported by URL into a new cube, 455 cards with none missed. That cube exported to every format re-imports all of its cards, except Draftmancer, which drops prospects by design. The Moxfield and Archidekt samples resolve with no misses.
- **Workbench** (2026-11-15): the top bar's import and export button opens a sheet. Import takes pasted text, a file, or a Cube Cobra link, then previews it: each board's status (changeable), lines to check (not found or guessed, each editable or skippable), warnings, skips, and the cards to add. It imports into this cube, or a new one in the desktop app. Export lists every format with what it drops and downloads the file. Routes: `POST /api/import/preview`, `POST /api/import`, `GET /api/export?format=`. Covered by a workbench e2e test and a desktop e2e test (new cube).
- **Left for done**: a real file saved by Cube Cobra (CSV), Draftmancer, MTGO, and Cockatrice; the XMage samples were written for its tests. Imported cards don't get [function](../GLOSSARY.md#function) tags yet, unlike the add panel.
