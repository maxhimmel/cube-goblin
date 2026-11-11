---
id: T-037
title: Try several moves at once in the Lab
status: doing
---

Hovering, dragging, or opening a card previews one move at a time. The user wants a bucket to drag several draft and prospect cards into and see what all of those adds and cuts do together across every chart, before committing any of them (2026-11-11). It is the bulk form of the per-card preview, and a way to work on [T-002](T-002-trim-draft-to-target.md) (the draft is over target).

## Sketch

- A tray in the Lab (working name: scenario) with two sides, "add to draft" and "cut from draft". Dragging a prospect in queues an add; dragging a draft card in queues a cut. Cards in it stay outlined where they sit.
- Every chart and the draft count show the whole set's ghost deltas, on top of any hover, drag, or opened card (`project` already takes a list of moves).
- Apply all as one undoable edit, clear, or remove one card. Whether a scenario can be named and saved (like a [layout](../GLOSSARY.md#layout)) or several can be compared is an open question for the user.
- Define the term in the glossary before naming it in code.

## Decisions (user, 2026-11-11)

- One unsaved set, no naming or comparing. Survives reload in localStorage.
- Called [Pending](../GLOSSARY.md#pending) ("Edit" already means one saved, undoable change).
- Space is tight; the user wants the macro view: no dock block (scrolls out of sight) and no overlay over the charts. Pick the tray layout from a demo.

## Layout spike

Real Pending state (queue, chart and draft-count deltas, Apply as one undoable edit, Clear, × per card, reload-safe), with four switchable layouts at `#/lab?pending=a|b|c|d` (header switch "Pending layout"). Common to all: queued cards stay in their pile with a dashed outline and +/− (cuts struck through); Alt-click a card to queue or unqueue it; "Drop: Move | Queue" makes dropping on the other pile queue instead of move.

- **A Marks in place**: no tray; a header chip `Pending +3 −4 · Apply · Clear` that lists the cards on hover and takes drops.
- **B Header strip**: a thin full-width chip row under the toolbar, a drop target.
- **C Gutter**: a slim column between Draft and Prospects, adds over cuts.
- **D Floor bar**: a thin bar fixed to the bottom of the window.

## Done when

- Several queued moves show in every chart at once, apply as one undoable edit, survive a reload, and are covered by e2e.
