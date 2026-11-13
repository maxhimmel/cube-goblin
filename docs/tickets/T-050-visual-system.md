---
id: T-050
title: Visual system and favicon
status: done
---

Part of [T-043](T-043-polish-pass.md). [Forge](../GLOSSARY.md#forge) is the reference look (user, 2026-11-13): its panels, headings, chips, buttons, and selection styles become the shared styles for every view. Tags and Versions look like bare HTML.

- Favicon: the user picked option E, two crossed cards with a star (2026-11-12), from six drafts in the app's violets.
- Type scale (user, 2026-11-13): a dev-only panel to tweak font sizes live and copy the result, so the user can pick sizes and hand them back. It needs the font sizes gathered into a few CSS variables first.

## Done when

- Favicon E ships in the workbench and the share doc.
- Every view uses the shared styles.

## Built (2026-11-12)

- Favicon E is inlined as an SVG data URI in `apps/web/index.html`, so the single-file share doc carries it too; a share-doc e2e decodes it.

## Built (2026-11-13)

- Type scale: every rem font size collapsed into nine `--fs-*` variables on `:root` in `apps/web/src/styles.css` (`--fs-root` plus `2xs` to `2xl`); nearby sizes merged (0.78 to 0.84rem became `--fs-sm`, and so on).
- Type scale panel: the "Aa" button bottom left in `pnpm dev` only (`import.meta.env.DEV`, absent from the build). Sliders per variable, read from the stylesheet; tweaks persist in localStorage; Copy CSS puts the `:root` lines on the clipboard to hand back; Reset clears them.
- Shared styles in `apps/web/src/ui.css`, taken from Forge: `.panel`, `.eyebrow` (small uppercase heading), `.segmented`, `.toggle-chip`, `.link-btn`, and the dropdown `Menu` (`apps/web/src/menu.tsx`). The old solid violet `.segmented` is gone, so Tags, Sketch, History, the card pane, and the add panel all get Forge's segmented control.
- Base `button`, `input`, and `select` take Forge's compact size. View titles (Tags, Insights, History) are screen-reader only like Forge's; the top bar names the view.
- History: stat groups and Change/Values are segmented controls, All/None are links, the timeline sits on a panel. Insights: blocks on the panel surface with uppercase headings, Forge's tinted stat tiles, Blocks uses the shared Menu.
- Drag surfaces (user, 2026-11-13): every draggable card strip and block head shows Forge's hover stipple, and Insights blocks use Forge's tile actions (table, collapse "–", hide) that show on hover. An e2e test fails any drag surface without the stipple or a collapse button that isn't Forge's.
