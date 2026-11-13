---
id: T-047
title: Tag workspace
status: doing
---

Part of [T-043](T-043-polish-pass.md). Board sections end up as tags anyway, so Board and Tags merge into one view with two modes: sketch (sections, drag cards) and overlaps (Venn diagram and matrix). Tag management (31 rows of field, dropdown, and id today) becomes an inline list edited in place, with empty tags flagged.

## One tag concept

The user sees tags, groups, and archetypes as one thing (2026-11-12). Today a [tag](../GLOSSARY.md#tag) has a kind, archetype or group; the only archetype tag has no cards. Drop the kind so every tag is just a tag, and leave archetypes to [T-005](T-005-synergy-and-combo-map.md). Update the glossary, `cube/tags.json`, and the code.

## Done when

- One view, one tag concept, glossary updated, e2e covers sketch, overlaps, and tag edits.
