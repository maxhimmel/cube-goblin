---
id: T-050
title: Visual system and favicon
status: todo
---

Part of [T-043](T-043-polish-pass.md). The Lab and Wall are polished; Tags and Versions look like bare HTML. One set of panels, headings, chips, buttons, and selection styles for every view.

- Favicon: the user picked option E, two crossed cards with a star (2026-11-12), from six drafts in the app's violets.

## Done when

- Favicon E ships in the workbench and the share doc.
- Every view uses the shared styles.

## Built (2026-11-12)

- Favicon E is inlined as an SVG data URI in `apps/web/index.html`, so the single-file share doc carries it too; a share-doc e2e decodes it.
