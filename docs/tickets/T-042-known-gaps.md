---
id: T-042
title: Known gaps
status: todo
---

Small bugs and rough edges found while building, kept here so the roadmap's Handoff stays short (moved from the Handoff, 2026-11-12).

- A cut card shows "In cube" in `#/add` search and comes back by changing its status, not by re-adding.
- Scryfall `reversible_card` layouts (no top-level oracle id) don't show in search.
- Tag-removal undo re-appends the tag at the end of the card's tags.
- An edit queued behind a failed one keeps an undo built from the failed state.
- A disk failure mid-write can leave a partial batch or an orphan batch line in `cube/inbox/workbench.txt`.
- Change log gaps are in [T-038](T-038-change-log.md#built-2026-11-12).

## Done when

- Each gap is fixed or moved to its own ticket, with a test for each fix.
