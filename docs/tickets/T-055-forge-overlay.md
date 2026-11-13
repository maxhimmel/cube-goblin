---
id: T-055
title: Forge overlay
status: todo
---

Forge compares the cube now with any other state of it, not only a friend's suggestions: a saved [version](../GLOSSARY.md#version), a point in [History](T-048-history.md), or a review's base plus its moves (user, 2026-11-13). Follows [T-054](T-054-reviews-view.md).

## Idea

Every such state reduces to a card status map, so the difference from now is a list of moves, the same shape as [pending](../GLOSSARY.md#pending). Forge picks one as its overlay and shows it the way it shows pending moves: ghost deltas on every chart and marks on tiles. One action copies the overlay's open moves into pending, where the owner edits and applies them as usual. History's From and To, and a review's "open in Forge", set the overlay.

## Open questions

- The term: "overlay" until checked against the glossary.
- Whether pending and an overlay show at once, and how their marks differ.
- Whether tag and section changes show, or only status.

## Done when

- Forge overlays a version, a History point, and a review, and adopting copies the open moves into pending, with e2e coverage.
