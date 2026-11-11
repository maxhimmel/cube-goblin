---
id: T-037
title: Try several moves at once in the Lab
status: todo
---

Hovering, dragging, or opening a card previews one move at a time. The user wants a bucket to drag several draft and prospect cards into and see what all of those adds and cuts do together across every chart, before committing any of them (2026-11-11). It is the bulk form of the per-card preview, and a way to work on [T-002](T-002-trim-draft-to-target.md) (the draft is over target).

## Sketch

- A tray in the Lab (working name: scenario) with two sides, "add to draft" and "cut from draft". Dragging a prospect in queues an add; dragging a draft card in queues a cut. Cards in it stay outlined where they sit.
- Every chart and the draft count show the whole set's ghost deltas, on top of any hover, drag, or opened card (`project` already takes a list of moves).
- Apply all as one undoable edit, clear, or remove one card. Whether a scenario can be named and saved (like a [layout](../GLOSSARY.md#layout)) or several can be compared is an open question for the user.
- Define the term in the glossary before naming it in code.

## Done when

- Several queued moves show in every chart at once, apply as one undoable edit, survive a reload, and are covered by e2e.
