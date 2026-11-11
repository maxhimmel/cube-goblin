---
id: T-038
title: Change log
status: todo
---

A running list of every edit next to the workbench, to see what changed, when, and why, and to bring changes back one at a time or in bulk (user, 2026-11-11).

## Today

- Undo (`apps/web/src/workbench/edits.ts`) is a stack that lives in the page and is gone on reload.
- [Versions](../GLOSSARY.md#version) ([T-014](T-014-versions-and-compare.md)) are snapshots the user saves by hand and compares.
- Git keeps every `chore(cube)` commit, but not per edit and not in the UI.

## Sketch

- The server appends one entry per write (status, tags, notes, printing, add, swap, board, filters, tags vocabulary) to a log in `cube/`, with time, the cards touched, before and after, and the edit's label ("Shock → draft", "Apply Removal to 12").
- A log panel or view groups entries by session or day, filters by card or kind, and links each card to its pane.
- Revert one entry or a selection as one new, undoable edit. A revert is itself logged, so nothing is lost. Entries whose cards changed since show a conflict instead of overwriting.
- "Why": an optional note on an entry. [Pending](../GLOSSARY.md#pending)'s Apply ([T-037](T-037-lab-scenario.md)) could work like a git commit: the user writes a message saying why, and it becomes the log entry's label and description, so the history reads as reasons, not just moves (user, 2026-11-11). Same idea may fit other bulk edits.
- Decide with the user how far back the log goes and whether it is committed like other cube data.

## Done when

- Every edit kind lands in the log, survives a reload, reverts singly and in bulk as undoable edits, and is covered by unit and e2e tests.
