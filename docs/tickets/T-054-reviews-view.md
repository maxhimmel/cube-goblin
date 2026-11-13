---
id: T-054
title: Reviews view
status: todo
---

A workbench view (`#/reviews`) for the reviews friends send back (user, 2026-11-13). Follows [T-051](T-051-share-doc-suggestions.md); absorbs "imported reviews aren't shown in the workbench" from [T-006](T-006-share-doc-polish.md).

## Scope

- Paste a review code or drop a saved share doc; the server stores it in `cube/reviews/` as the CLI does today.
- One list of every review: reviewer, date, base version, counts of votes, comments, and moves.
- A review opens to its votes, comments, and suggested moves, each marked against the cube now: still open, already done, or the card changed since the base version.
- From a review: compare its base version with now in [History](T-048-history.md), and open it in Forge through [T-055](T-055-forge-overlay.md).
- The card detail pane lists every reviewer's vote and comment on that card.

## Done when

- A review from the share doc shows in `#/reviews` with each suggestion's status against now, with e2e coverage.
