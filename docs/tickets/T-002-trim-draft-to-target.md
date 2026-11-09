---
id: T-002
title: Trim draft to target size
status: todo
---

The draft has 116 cards; the target range is in `cube.config.json` (`pnpm cube validate` prints both). Pick cuts together with the user, ideally in the workbench ([T-001](T-001-editing-workbench.md)), using synergy and archetype discussion.

Not a priority (user, 2026-11-09): the workbench is for tweaking, so a draft over the target is a normal working state, and the UI shows it as information, not an error.

## Done when

- The draft count is inside the configured range, and `pnpm cube validate` reports "within".
