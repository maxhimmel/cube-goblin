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

Real Pending state (queue, chart and draft-count deltas, Apply as one undoable edit, Clear, × per card, reload-safe), with switchable layouts at `#/lab?pending=a|b|c|e` (header switch "Pending layout"). Common to all: queued cards stay in their pile with a dashed outline and +/− (cuts struck through); Alt-click a card to queue or unqueue it; drag a card onto the tray to queue it. Trays list queued cards as the piles' own strips, in the Lab's sort order, under "Add to draft" and "Cut from draft".

- **A Header chip**: `Pending +3 −4 ▾ · Apply · Clear`; click opens the list, which stays open until a click outside or Esc.
- **B Header strip**: a thin full-width row under the toolbar.
- **C Gutter**: between Draft and Prospects (the move from one to the other); a thin rail until clicked, then a column.
- **E Dock block**: a "Pending" block in the chart dock.

### Feedback round 1 (user, 2026-11-11)

- Likes A (succinct) and B and C. C's spot makes sense: it sits between the two piles.
- B and C chips didn't match the card strips or sort: now they use the strips and the sort chain.
- Wanted C collapsed until clicked, and a dock-block version to compare: added both (E).
- "Drop: Move | Queue" was unclear and seemed to do nothing: removed; drop on the tray instead.
- A's hover list closed while moving the mouse into it: now click-to-open.
- D (floor bar) not picked: removed.

## Done when

- Several queued moves show in every chart at once, apply as one undoable edit, survive a reload, and are covered by e2e.
