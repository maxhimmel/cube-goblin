---
id: T-011
title: Board view
status: done
---

The Board in [views.md](../design/views.md): drag cards into buckets on a big grid to see groups before tagging them. Buckets are a saved sketch on disk, separate from tags; a bucket can be turned into a group or archetype tag (user, 2026-11-09).

## Decisions (user, 2026-11-10)

- A card can sit in several bins. Dragging from the pool copies; dragging between bins moves (hold Alt to copy); dragging back to the pool takes it out.
- The pool offers draft and prospect cards, with a name filter and a Both / Draft / Prospects switch. A hint bar above the bins explains the drag gestures (user moved it there from under the pool). The hint bar spans the board. The pool header mirrors a bin header (filter and count, then status switch and "No bin" toggle) at fixed row heights, so the first pool card lines up with the first card in each bin; bins in a row share row heights (CSS subgrid). An e2e test checks the alignment.
- A promoted bin stays on the Board, linked to its tag. Adding cards later offers "Tag N more".
- The boxes are called bins, since "bucket" already means a chart bucket in Insights. (Renamed to sections in [T-018](T-018-sections-on-the-board.md).)

- "Sort cards by … then …" (Added, Name, Mana value, Color, Card type; `?sort=color.mv`) orders the cards in every bin and the pool. It changes the view only; `board.json` keeps the order cards were added (user, 2026-11-10).

## Done when

- Buckets and their cards survive a reload.
- Promoting a bucket adds its tag to every card in it, as one undoable edit.
