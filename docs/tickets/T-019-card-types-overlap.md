---
id: T-019
title: Card types overlap
status: todo
---

Card types are too coarse: Instant and Sorcery share a bucket, and a card counts as one type only (user, 2026-11-10).

## Decisions (user, 2026-11-10)

- Instant and Sorcery are separate types.
- A card counts under every [card type](https://mtg.wiki/page/Card_type) on its front face: an Artifact Creature is both Artifact and Creature, an Artifact Land is both Artifact and Land.
- The overlap applies everywhere a card is grouped by type: the Insights card-types chart, Wall columns, and Cards "Organize by". Sorting still uses one type, the first match.

## Done when

- Insights shows Instant and Sorcery apart, and an Artifact Creature adds to both bars.
- The Wall and Cards show an Artifact Creature in both columns or piles.
