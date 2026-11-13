---
id: T-046
title: Merge the Wall and the Lab
status: done
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

## Built (2026-11-12)

- Forge (`apps/web/src/forge/`, the old `lab/`) is the root view in the workbench and the share doc. The Wall page and the Cards grid page are gone; `#/lab` redirects to `#/`, and `#/cards` redirects into the Images layout, keeping `?card=`.
- Card layouts: Columns, Rows, Images. Images groups tiles by the Forge axis with a checkbox per group and per card, the bulk bar above the draft, share-doc vote marks, a faded look for cut cards, and the same dim, pending, drag, and hover preview as strips. Organizing the grid by status or tag kind is dropped; tags get their own workspace in [T-047](T-047-tag-workspace.md).
- Toolbar: query bar, Blocks, Layouts, and switches for Charts, Baseline, and Show cut. Settings gets a Forge section kept in the browser: dim or hide non-matches, the chart panel's side (default right), and tags on cards. Below 1280px the panel sits above the cards whatever the setting says.
- `useRemembered` now tells every component reading a key when it changes, so the settings dialog updates Forge live.
- The Tags view links to `#/?q=<query>`, which applies the query as Forge's one filter pill.
- Fix found on the way: applying a filter pill wrapped the query bar to a second line, which pushed the charts down under the pointer. Pills and the query now share one row that scrolls sideways.
- CSS classes and stored keys keep their `lab` names so saved layouts and settings carry over.
- E2E: every Wall, Cards, and Lab test now drives Forge; new tests for group selection in Images and for the settings that moved.
