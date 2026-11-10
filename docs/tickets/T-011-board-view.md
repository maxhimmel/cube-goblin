---
id: T-011
title: Board view
status: done
---

The Board in [views.md](../design/views.md): drag cards into buckets on a big grid to see groups before tagging them. Buckets are a saved sketch on disk, separate from tags; a bucket can be turned into a group or archetype tag (user, 2026-11-09).

## Decisions (user, 2026-11-10)

- A card can sit in several bins. Dragging from the pool copies; dragging between bins moves (hold Alt to copy); dragging back to the pool takes it out.
- The pool offers draft and prospect cards, with a name filter.
- A promoted bin stays on the Board, linked to its tag. Adding cards later offers "Tag N more".
- The boxes are called bins, since "bucket" already means a chart bucket in Insights.

## Done when

- Buckets and their cards survive a reload.
- Promoting a bucket adds its tag to every card in it, as one undoable edit.
