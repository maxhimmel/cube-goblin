---
id: T-056
title: Desktop app
status: todo
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

## Done when

- The built app opens this repo's cube and every view works as in `pnpm dev`. The e2e workbench suite, or a smoke subset of it, passes against the Electron build in `pnpm check`.
