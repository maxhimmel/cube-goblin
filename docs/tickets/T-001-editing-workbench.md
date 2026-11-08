---
id: T-001
title: Editing workbench
status: todo
---

Edit the cube in a local web app instead of hand-editing JSON. Edits save to `cube/cards/*.json`, so git history is the edit log. Goals: [VISION.md](../VISION.md).

## Known so far

- The local app is `apps/web` (`pnpm dev`). It's the same app as the share doc, but a different mode. Background: [rendering-and-sharing.md](../research/rendering-and-sharing.md).
- Card files follow `cardEntrySchema` in `packages/cube/src/schema.ts`: status (`draft` / `prospect` / `cut`), section, tags, notes.
- Saving needs a dev-only write endpoint, since the browser can't write repo files itself. Plan: a small Vite dev-server plugin, not TanStack Start (the reasons are in the research doc).

## Open questions (ask user before building)

- Which edits come first: status changes (draft, prospect, cut), tags and archetypes, notes, adding cards from search, swapping a card for another?
- One card at a time, or bulk (multi-select, then set status)?
- Should edits auto-save, or save explicitly? Each save is one file write; commits stay manual.
- What do tags and archetypes look like: free text, or a fixed list in a config file?

## Done when

- The user can make the agreed edits in the browser, and they land in `cube/cards/*.json`.
- `pnpm check` passes. e2e covers at least one edit making it to disk.
