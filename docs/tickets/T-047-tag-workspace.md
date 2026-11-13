---
id: T-047
title: Tag workspace
status: done
---

Part of [T-043](T-043-polish-pass.md). Board sections end up as tags anyway, so Board and Tags merge into one view with two modes: sketch (sections, drag cards) and overlaps (Venn diagram and matrix). Tag management (31 rows of field, dropdown, and id today) becomes an inline list edited in place, with empty tags flagged.

## One tag concept

The user sees tags, groups, and archetypes as one thing (2026-11-12). Today a [tag](../GLOSSARY.md#tag) has a kind, archetype or group; the only archetype tag has no cards. Drop the kind so every tag is just a tag, and leave archetypes to [T-005](T-005-synergy-and-combo-map.md). Update the glossary, `cube/tags.json`, and the code.

## Done when

- One view, one tag concept, glossary updated, e2e covers sketch, overlaps, and tag edits.

## Built (2026-11-13)

- `#/tags` has two modes, kept in the URL and remembered: **Overlaps** (default) and **Sketch**. `#/board` redirects to Sketch and keeps its sort. The Board nav link is gone; the share doc shows Overlaps only, read-only.
- Overlaps puts a tag list beside the Venn diagram and matrix: a checkbox picks a tag, the name is an input renamed in place (Enter saves, Escape reverts), the count is draft and prospect cards, a tag with none is flagged "empty" and can't be picked, and a field at the bottom creates a tag. The old table of label, kind, and id is gone; the id shows in the name's tooltip.
- One tag concept: `kind` is gone from the schema, API, tag picker ("Create tag"), and versions page. Forge's Archetypes and Groups blocks and Insights' two tag charts are one Tags chart each. `migrateLegacyCube` strips `kind` from `tags.json`, the change log, and versions (and drops log tag changes that only switched kind), so git backfill still reads old commits.
- Fixed on the way: board sections squeezed below their cards and overlapped the next row whenever the board was short of height (`grid-auto-rows: max-content`).
- E2E: modes, the `#/board` redirect, empty flag, create and rename in the list, remembered mode; the ring-crop sweep covers both modes.
