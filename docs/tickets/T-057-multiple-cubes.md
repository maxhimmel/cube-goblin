---
id: T-057
title: Multiple cubes
status: todo
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

## Done when

- Two cubes can be created and opened side by side in turn, each keeping its own cards, tags, history, and view choices. e2e covers create, switch, and reopen.
