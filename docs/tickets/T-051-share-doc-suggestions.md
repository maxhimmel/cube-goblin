---
id: T-051
title: Suggestions from the share doc
status: doing
---

Reviewers should use [Forge](../GLOSSARY.md#forge) in the share doc as the owner does: try adds and cuts as [pending](../GLOSSARY.md#pending) moves, watch the charts react, and send the moves back in the review code with their votes and comments (user, 2026-11-12). Follows [T-046](T-046-wall-and-lab.md). Tinkering in Forge is "the funnest part" (user, 2026-11-13), so the reviewer gets the full Forge, settings included.

First of three tickets that turn a friend's review into something the workbench can compare with the cube now: this one (the share doc sends), [T-054](T-054-reviews-view.md) (the workbench receives), [T-055](T-055-forge-overlay.md) (Forge shows any other state of the cube against now).

## Scope

- The review code carries the reviewer's pending moves next to votes and comments; old codes without moves still decode.
- `pnpm export` saves a [version](../GLOSSARY.md#version) of the cube it ships, and the share doc's snapshot id points to it, so a review always has a base to compare against.
- The share doc gets Forge's view settings (dim or hide, panel side, tags on cards).
- Each export keeps its own browser storage (review, pending moves, view settings), so two copies opened from `file://` don't mix (from [T-006](T-006-share-doc-polish.md)).

## Done when

- A reviewer's pending moves, votes, and comments survive the review code and the saved HTML, and `pnpm cube review import` keeps them, with e2e coverage.
- An export writes a version file that its reviews name as their base.
- Two exports opened side by side keep separate state, with e2e coverage.
