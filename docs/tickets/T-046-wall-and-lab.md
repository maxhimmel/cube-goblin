---
id: T-046
title: Merge the Wall and the Lab
status: doing
---

Part of [T-043](T-043-polish-pass.md). The [Lab](T-031-lab-view.md) already holds the Wall's columns, the prospects, charts, and filters. One view replaces both, with charts and filters as an optional side panel. It is called **Forge** (user, 2026-11-12); see the [glossary](../GLOSSARY.md#forge).

## Decisions (user, 2026-11-12)

- Forge lives at `#/`; `#/lab` and `#/cards` redirect to it.
- The Cards image grid folds in as a third card layout (Columns, Rows, Images) with its multi-select and bulk bar.
- The toolbar keeps Baseline and Show cut. Dim or hide non-matches, tags on cards, and the chart panel's side move to the settings dialog ([T-045](T-045-top-bar-and-settings.md)).
- Charts and filters sit in one panel with a single show/hide toggle.
- The share doc gets Forge too. Reviewers should be able to use it like the owner does and send suggestions back: [T-051](T-051-share-doc-suggestions.md).

## Done when

- One view does both jobs, nothing overflows at 900px or 1440px, and [views.md](../design/views.md) and e2e follow.
