---
id: T-018
title: Sections on the Board
status: done
---

Card sections only tracked where a batch of cards came from. Drop them, and call the Board's boxes sections instead of bins (user, 2026-11-10).

## Decisions (user, 2026-11-10)

- A Board bin becomes a [section](../GLOSSARY.md#section): same behavior, new name in UI, code, docs, and `cube/board.json`.
- The card `section` field goes away, with `cube/sections.json`, the Cards "Organize by section", bulk section, the pane's section field, and the Insights sections chart.
- Each card that had a section gets the line `Deck: <section label>` at the end of its notes. The old sections don't become Board sections.
- Bulk pastes were a one-time import: `cube/inbox/batch-001.txt` and `batch-001-fixes.txt` are deleted (git keeps them; each card keeps its own `source` line), and batch header lines are no longer parsed. `cube/inbox/workbench.txt` stays.

## Done when

- No card file, schema, CLI command, or view mentions a card section.
- The 27 cards that had a section carry its `Deck: <label>` note.
- The Board says "section" everywhere it said "bin", and `cube/board.json` loads with a `sections` key.
