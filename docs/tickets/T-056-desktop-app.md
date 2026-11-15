---
id: T-056
title: Desktop app
status: done
---

The workbench runs as a desktop app, not only as `pnpm dev` (user, 2026-11-15). Electron, local unsigned macOS builds first; signing and auto-update come later. Research: [desktop-shell.md](../research/desktop-shell.md).

## Decisions (user, 2026-11-15)

- Electron, not Tauri or a PWA: its main process is Node, so `packages/cube` and `packages/scryfall` run as they are.
- For the user first; friends later. No signing, notarizing, or auto-update in this ticket.

## Scope

- **Spike first**: a new `apps/desktop` (electron-vite + electron-builder) opens one window that loads `GET /api/cube` over `app://` and gets a `cube:changed` push from a file watcher. An unsigned `--mac dir --arm64` build launches, and one Playwright `_electron` test passes. Record what the spike finds in the research note before porting the remaining routes.
- Move the routes out of `apps/web/server/workbench-plugin.ts` into a shared `(Request) => Response` handler. The Vite plugin and Electron's `protocol.handle` both mount it, so `apps/web/src/workbench/api.ts` and `<img src>` stay unchanged.
- The client listens for `cube:changed` through the preload bridge or `import.meta.hot`, whichever exists.
- Security baseline from the research note: Electron's defaults kept, CSP, deny-all permissions, locked-down navigation, a sender check on every IPC handler.
- `pnpm desktop` runs it in dev; `pnpm desktop:build` makes the unsigned app.

## Built (2026-11-15)

- **Shared handler**: `packages/server` (`createWorkbenchServer`) holds every route and the image cache. `apps/web/server/workbench-plugin.ts` is now a thin Node-to-`Request` adapter.
- **App**: `apps/desktop` (electron-vite 6, Electron 45, electron-builder 26). Main serves `app://bundle` and pushes `cube:changed` from `fs.watch`. The preload exposes only `onCubeChanged`, typed by `DesktopBridge` in `@repo/server/events`. Spike findings: [desktop-shell.md](../research/desktop-shell.md#spike-results-2026-11-15).
- **Which cube**: `CUBE_REPO_ROOT`, else this repo in dev, else a folder picked once and kept in `userData/settings.json`. [T-057](T-057-multiple-cubes.md) replaces this. Scryfall caches live in `userData/cache` (`CUBE_CACHE_DIR` overrides).
- **Commands**: `pnpm desktop` (dev) and `pnpm desktop:build` (unsigned arm64 `.app` in `apps/desktop/release`). `pnpm check` runs `e2e:desktop`.
- **Gaps**: no app icon; no renderer HMR in the desktop app; the packaged `.app` isn't in automated e2e (its fuses block Playwright); macOS only.

## Done when

- The built app opens this repo's cube and every view works as in `pnpm dev`. The e2e workbench suite, or a smoke subset of it, passes against the Electron build in `pnpm check`.
