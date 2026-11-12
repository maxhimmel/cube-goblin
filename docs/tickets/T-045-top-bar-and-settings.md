---
id: T-045
title: Top bar and settings
status: done
---

Part of [T-043](T-043-polish-pass.md). The top bar carries three bits of status text ("143 cards • live from cube/cards", "workbench • live", "all changes saved") plus "loading…"; it has bugged the user (2026-11-12).

- One save indicator in place of the status text.
- Add card becomes a top bar action (a "+" opening a quick-add panel) instead of a nav link to `#/add`.
- A global settings panel: one place for choices that today are scattered per view (the Lab's toolbar toggles, Board help, hide empty from [T-033](T-033-hide-empty.md)). Settings also edit the cube's target range and format, which today need a code edit of `cube.config.json` (user, 2026-11-12); the panel writes that file, which stays the one source. Its contents settle as the merges land; [T-034](T-034-persistence-audit.md) inventories every stored setting.

## Done when

- The top bar shows brand, views, save state, "+", and settings, and nothing else; covered by e2e.

## Built (2026-11-12)

- The top bar is brand, views, a save state ("Saved" / "Saving…", over every pending write; a load error takes its place), "+", and a settings button. The card count, "live from cube/cards", and the "workbench · live" badge are gone; the share doc shows its snapshot id beside its review controls.
- "+" opens the add panel, a modal over the current view (`?add=true`; a swap adds `replaces`). The card pane's swap link opens it too; after an add the card's pane opens on the same view. `#/add` redirects to it.
- Settings is a modal with a Cube section: format and target size, saved through `PUT /api/config` (`saveConfig`, `packages/cube/src/save-config.ts`) to `cube.config.json`, which stays the one source. View settings (Lab toggles, Board help, hide empty) move in as [T-046](T-046-wall-and-lab.md) and [T-047](T-047-tag-workspace.md) reshape those views.
- E2E: the top bar's contents, the add panel over Insights and from `#/add`, and settings writing the file and moving the Wall's target.
- Follow-up (user, 2026-11-12): the view links became a segmented control (soft track, active view a raised chip), picked from five variants (pills, underline, tint, segmented, dot). Add card and settings use simple line icons (`apps/web/src/icons.tsx`): a card with a plus and a six-tooth cog. The top bar blurs and casts a shadow once the page scrolls under it. Every `select` gets a thin chevron with room from the edge.
- Second follow-up (user, 2026-11-12), picked from galleries of nav, icon, and hover variants: each view link has an icon and its label. On hover a grey chip springs in and the icon hops; links never change width on hover, because labels that opened on hover moved the next link from under a fast-moving pointer. The active view is solid violet with a soft glow. Under 1100px only the active view shows its label. Add card is a plain plus; settings is a filled flower cog (`apps/web/src/icons.tsx`).
