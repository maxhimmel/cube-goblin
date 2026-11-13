---
id: T-006
title: Share doc polish
status: todo
---

Deferred by the user (2026-11-08): editing comes first. Known gaps from the proof of concept ([rendering-and-sharing.md](../research/rendering-and-sharing.md)):

- Large card images are hotlinked, so they need internet.
- Two copies of the same snapshot share `localStorage` on `file://`: moved to [T-051](T-051-share-doc-suggestions.md).
- Imported reviews aren't shown in the workbench yet: moved to [T-054](T-054-reviews-view.md).
- The [Lab](T-031-lab-view.md) and its named layouts should be in the export (user, 2026-11-11): Forge ships in the export; its settings via [T-051](T-051-share-doc-suggestions.md).

## Done when

- The user picks which gaps matter, and those are closed with e2e coverage.
