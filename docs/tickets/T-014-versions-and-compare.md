---
id: T-014
title: Versions and compare
status: done
---

Save versions of the cube and compare things side by side: two cards, two groups of cards, or two versions (user, 2026-11-09). Board sketches ([T-011](T-011-board-view.md)) may be saved the same way.

## Decisions (user, 2026-11-10)

- A version holds the whole cube state: every card (status, tags, notes, printing), the tag list, and Board sections.
- A version is a snapshot file, `cube/versions/<date>-<label>.json`, committed like other cube data.
- This ticket covers versions only. Comparing two cards or two groups moved to [T-026](T-026-compare-cards-and-groups.md).

## Built (2026-11-10)

- `#/versions` (workbench only) saves a version under a name, lists versions with their status counts, and compares any two of them or one with the current cube (`?from=&to=`, `current` for now).
- The comparison shows status counts on both sides, cards added, moved between statuses (grouped by move), gone, and edited (tags added or removed, notes, printing), plus tag-list and Board section changes. Card names open the detail pane.
- `diffCube` (`packages/cube/src/diff.ts`) and `saveVersion` / `compareVersions` (`packages/cube/src/versions.ts`) hold the logic; `pnpm cube validate` checks the version files.
- The share doc has no versions yet.

## Open questions (before the decisions)

- What a version holds: the card list and statuses, or tags, notes, and Board sections too.
- Whether a version is a git commit, a file under `cube/`, or both.

## Done when

- The user has answered the open questions.
- A version can be saved, listed, and compared with the current cube, showing cards added, cut, and changed.
