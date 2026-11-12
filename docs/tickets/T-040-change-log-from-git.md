---
id: T-040
title: Change log from git history
status: done
---

Rebuild [change log](T-038-change-log.md) entries for the edits made before the log existed, from git history (user, 2026-11-12).

## Sketch

- A `pnpm cube` command walks commits that touch `cube/`, reads the cube state at each, diffs neighbors, and writes one entry per commit with the commit's subject and body as its message, the commit time, and the stats after it.
- Rebuilt entries say so (a trailer like `Source: git <sha>`) and sit before the live entries.
- Ask the user whether to keep cards-only commits and merge commits.

## Decisions (user, 2026-11-12)

- One entry per non-merge commit that touches `cube/`, with its own message; merges are skipped.
- Keep every commit that changed the cube, even ones that move no stats (printings, sections, notes).

## Built (2026-11-12)

- `pnpm cube backfill-log [--dry-run]` (`apps/cli/src/commands/backfill-log.ts`) diffs each commit against its first parent, reading both from `git archive`. `migrateLegacyCube` (`packages/cube/src/legacy.ts`) brings checkouts from before 2026-11-10 up to today's format first: a card's `section` becomes a `Deck: <label>` note as in `6d89850`, board `bins` become `sections`, and a missing `tags.json` means no tags. Format-only commits come out empty and are skipped.
- `backfill` (`packages/cube/src/backfill.ts`) drops any change a live entry already records (same before and after), writes entries with source `git`, the commit's author time, its subject without the conventional prefix, its body without trailers, and a `Source: git <sha>` trailer, then rewrites the log with git entries first. A second run finds every sha and writes nothing. Stats use today's Scryfall data and stat rules (`stateStats`, shared with the dev server).
- First run: 15 entries, from the first import (the timeline's baseline) to the balancing pass.
- Known gaps: a commit's time is when it was committed, so a rebuilt entry can read as later than a live one listed above it; a commit that mixes a logged edit with other changes to the same card keeps that card's change.

## Done when

- The command fills the log for the history before T-038 without duplicating live entries, and a second run changes nothing; covered by unit tests.
