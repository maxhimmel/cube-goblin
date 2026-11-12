---
id: T-041
title: Change log in the share doc
status: done
---

The share doc (`pnpm export`) carries the [change log](T-038-change-log.md) as its own tab, read-only, with the [stats timeline](T-039-stats-timeline.md) once it exists (user, 2026-11-12).

## Built (2026-11-12)

- `pnpm cube snapshot` reads `cube/log.jsonl` into the snapshot's `log` as is, card notes included (user, 2026-11-12: no hiding).
- The share doc's `#/log` is the workbench's `LogView` with no selection or Revert, and the Log tab shows in both modes.
- Known gaps: the share doc's card pane does not list the card's entries; the doc carries the whole log, so it grows with every entry.

## Done when

- The exported doc shows the log's entries and messages, checked in the share e2e.
