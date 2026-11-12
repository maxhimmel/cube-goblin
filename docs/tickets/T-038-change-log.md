---
id: T-038
title: Change log
status: done
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

## Decisions (user, 2026-11-12)

- The log is committed cube data and keeps everything: `cube/log.jsonl`, append-only, one entry per line.
- Its purpose: see the reasoning behind edits and how they moved the cube's stats over time, toward balance.
- Each entry carries the stats it moved. The auto message lists those deltas, so a bare Apply still reads as more than a move list.
- Messages use one syntax that a person reads first and a machine parses easily: git-commit style (subject line, optional body, then `Key: value` trailers as in [`git interpret-trailers`](https://git-scm.com/docs/git-interpret-trailers)). Shown a real entry, the user picked one stats trailer per group (2026-11-12): `Counts:`, `Curve:`, `Colors:`, `Types:`, `Tags:`, after one `Card:`, `Tag:`, `Section:`, or `Filter:` line per change.
- Its own nav view, `#/log` (the share doc has no Versions view and must carry the log, [T-041](T-041-change-log-in-share-doc.md)). The card pane shows that card's entries.
- Split out: a stats timeline next to the entries ([T-039](T-039-stats-timeline.md)), rebuilding entries from git history ([T-040](T-040-change-log-from-git.md)), the log in the share doc ([T-041](T-041-change-log-in-share-doc.md)).

## Built (2026-11-12)

- Engine: `packages/cube/src/log.ts` (entry schema, changes, stats, message), `save-log.ts` (`recordEdit`, `revertEntries`), `revert.ts` (`planRevert`). Every write route except layouts and versions is logged by the dev server (`apps/web/server/workbench-plugin.ts`), which reads the state before the write and diffs it after. `GET /api/log`, `POST /api/log/revert` (`{ ids }`; 409 when a card, tag, section, or filter changed since).
- Each entry: `id`, `at`, `source` (`workbench`, `revert`, `git` for [T-040](T-040-change-log-from-git.md)), `message`, `reverts`, full before and after of every changed card, tag, section, and filter, and `stats` after (status counts over the cube; mana value, colors, types, and tags over the draft; keys like `mv.3`, `color.R`, `tag.removal`).
- The client sends a subject and body in `X-Log-Subject`/`X-Log-Body` (URI-encoded). Edits with a generic toast label (card pane) send an empty subject, and the server writes one from the change ("Shock +burn"). Back-to-back notes saves on one card within 10 minutes of the first fold into one entry (not when anything else changed the card between them). Headers cap the Apply message at 200 characters and the why at 1000.
- A filter's `view` (how its Insights block shows it) is display, not a cube edit: a write that changes only views logs nothing (user, 2026-11-12: three "Moon-Letter Payoffs changed" entries were block view switches).
- A revert is an entry with source `revert`; its Undo reverts the revert. It computes its entry before writing, so a failure writes nothing. A malformed log line names its line number and does not stop new entries.
- Known gaps: reverted tags, sections, and filters return at the end of their lists; reverting an add leaves its line in `cube/inbox/workbench.txt`; a bulk revert whose net effect is nothing answers "Nothing to revert"; the server reads the whole log on each write.

## Done when

- Every edit kind lands in the log, survives a reload, reverts singly and in bulk as undoable edits, and is covered by unit and e2e tests.
