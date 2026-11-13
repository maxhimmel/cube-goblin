---
id: T-050
title: Visual system and favicon
status: todo
---

Part of [T-043](T-043-polish-pass.md). [Forge](../GLOSSARY.md#forge) is the reference look (user, 2026-11-13): its panels, headings, chips, buttons, and selection styles become the shared styles for every view. Tags and Versions look like bare HTML.

- Favicon: the user picked option E, two crossed cards with a star (2026-11-12), from six drafts in the app's violets.
- Type scale (user, 2026-11-13): a dev-only panel to tweak font sizes live and copy the result, so the user can pick sizes and hand them back. It needs the font sizes gathered into a few CSS variables first.

## Done when

- Favicon E ships in the workbench and the share doc.
- Every view uses the shared styles.

## Built (2026-11-12)

- Favicon E is inlined as an SVG data URI in `apps/web/index.html`, so the single-file share doc carries it too; a share-doc e2e decodes it.
