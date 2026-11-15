---
id: T-057
title: Multiple cubes
status: done
---

The workbench handles more than one cube instead of the single `cube/` in this repo (user, 2026-11-15). Needs [T-056](T-056-desktop-app.md) for the folder picker; the browser dev server keeps working on one folder.

## Decisions (user, 2026-11-15)

- **Hybrid storage**: "New cube" creates `~/Documents/Cubes/<name>/` without asking. "Open folder…" adds any other folder, this repo's `cube/` included. A cube is a plain folder in today's format, so git, the CLI, and Claude can work on it.

## Scope

- A cube folder holds its own config: `cube.config.json` moves inside it, with a name and a stable id. A migration moves this repo's root config into `cube/`.
- `cubePaths` takes the cube folder, not the repo root. The server handles one open cube at a time and switches on request.
- Cube switcher in the top bar: recent cubes (stored in main under `userData`), New cube, Open folder…, Remove from list (the files stay). The app reopens the last cube.
- Browser storage (`localStorage` view choices, layouts) is scoped per cube id through `scopeStorage`, as the share doc does.
- Hardcoded names (`maxs-cube` storage keys, the export file name, the title) come from the cube's name. Keys move with a one-time migration so today's choices survive.
- CLI: `pnpm cube --cube <dir>`, defaulting to this repo's `cube/`. `pnpm export` and `pnpm check`'s cube data guard take the same option.
- History's git backfill works when the cube folder is in a git repo and is skipped when it isn't.
- The glossary defines "cube folder".

## Built (2026-11-15)

- **Cube folder** ([glossary](../GLOSSARY.md#cube-folder)): `packages/cube/src/cube-folder.ts` creates, finds, and opens one. Opening fills in a missing id or name once (name from the folder, or from the repo for a `cube/` folder), which is the migration for old configs. This repo's config moved to `cube/cube.config.json`. `cubePaths` takes the cube folder.
- **Server**: `createWorkbenchServer({ cubeDir })` serves one cube and `open(dir)` switches after queued writes finish. Writes carry `X-Cube-Id`; one sent for a cube that is no longer open gets a 409, so a late save can't land in the other cube.
- **Desktop**: recent cubes in `userData/cubes.json` (the old `settings.json` folder is read once). Start order: `CUBE_DIR`, the last cube, this repo's `cube/` in dev, else a New cube / Open folder… prompt. New cubes go to `~/Documents/Cubes/<slug>/` (`CUBES_HOME` overrides) with the open cube's format and size. Switcher: the chevron beside the brand; switching waits for saves, then reloads. Fixed while here: the navigation guard compared `URL.origin`, which is `"null"` for `app://`, so it also blocked the app's own reloads.
- **Browser storage**: keys are `cube:<name>@<id>` (`storage-scope.ts`); old `maxs-cube:` keys move into the first cube opened, once. Title, brand, review download, and export file names come from the cube's name; Settings can rename it.
- **CLI**: `--cube <dir>` on every cube command; `pnpm export --cube` and `pnpm check --cube` pass it on. `backfill-log` runs git from the cube folder's repo and skips a folder that isn't in one. Reviews import into `<cube>/reviews/`.
- **Gaps**: the browser dev server has no switcher (it opens `CUBE_DIR` or `cube/`); two folders with the same id (a copied folder) share view choices.

## Done when

- Two cubes can be created and opened side by side in turn, each keeping its own cards, tags, history, and view choices. e2e covers create, switch, and reopen.
