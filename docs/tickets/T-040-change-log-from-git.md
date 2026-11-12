---
id: T-040
title: Change log from git history
status: todo
---

Rebuild [change log](T-038-change-log.md) entries for the edits made before the log existed, from git history (user, 2026-11-12).

## Sketch

- A `pnpm cube` command walks commits that touch `cube/`, reads the cube state at each, diffs neighbors, and writes one entry per commit with the commit's subject and body as its message, the commit time, and the stats after it.
- Rebuilt entries say so (a trailer like `Source: git <sha>`) and sit before the live entries.
- Ask the user whether to keep cards-only commits and merge commits.

## Done when

- The command fills the log for the history before T-038 without duplicating live entries, and a second run changes nothing; covered by unit tests.
