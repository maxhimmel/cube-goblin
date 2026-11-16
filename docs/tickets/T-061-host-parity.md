---
id: T-061
title: Host parity
status: doing
---

The desktop app and the web app have drifted apart: managing cubes and saving them offline exist only on desktop ([T-057](T-057-multiple-cubes.md), [T-058](T-058-offline.md) gaps). The user wants both [hosts](../GLOSSARY.md#host) to stay in step as far as each platform allows, and the web app to be the quick way to check a feature (user, 2026-11-16). Principle: [VISION](../VISION.md#apps).

## Why they drifted

- The routes were shared (`packages/server`), but cube management went over Electron IPC as `DesktopBridge.cubes`, with no web version.
- Views read `window.desktop?.cubes` directly (`cube-switcher.tsx`, `import-export-panel.tsx`); being optional, its absence compiles and the feature hides itself.
- Each ticket's e2e covered desktop only.

## Scope

- **`CubeHost` interface**, required: list, create, open, switch, remove, offline status, `onCubeChanged`, plus typed capabilities (e.g. `pickFolder: "native" | "path"`). Picked once at boot; views never touch `window.desktop` or `import.meta.hot`.
- **Desktop adapter**: wraps today's preload bridge.
- **Web adapter**: new `/api/cubes/*` routes on the shared handler, backed by the same recent-cubes store and `createWorkbenchServer().open(dir)` the desktop main uses. Move that store from `apps/desktop` into `packages/server` so both hosts share it. "Open folder…" on web takes a typed path. The web dev server gets the cube switcher, New cube, and "Make available offline".
- **Guards**: a lint rule bans `window.desktop` outside the desktop adapter; a contract test runs the same cases against both adapters; the cube create, switch, reopen, and offline flows run in both e2e suites.
- A feature one host can't have is declared as a capability, and the UI shows its equivalent or nothing on purpose.

## Built (2026-11-16)

- **Changed from the plan**: cube management moved off IPC entirely. Both hosts serve `/api/cubes` through the shared handler, so there is one implementation, not one per adapter. IPC keeps only what needs Electron: the native folder dialog and `cube:changed`.
- **Server**: `CubeLibrary` (`packages/server/src/cubes.ts`) holds the rules desktop main had: list, create in `CUBES_HOME`, switch only to recent cubes, open a folder, remove, offline status. `createCubeHostServer` mounts it before the workbench routes; `startingCube` picks the cube to open at start (recent first, then a fallback) for both hosts. `RecentCubes` moved to `packages/server`. Cube routes accept only JSON and refuse `Sec-Fetch-Site: cross-site`. `openByPath` is on for web, off for desktop (which uses the dialog).
- **Web dev server**: starts on `CUBE_DIR`, else the most recent cube, else `cube/`. Recent list in `.cache/workbench` (`CUBE_USER_DATA`), new cubes in `~/Documents/Cubes` (`CUBES_HOME`), as desktop. The file watcher follows a switch.
- **Client**: `apps/web/src/host/` holds `CubeHost` (`cubes`, `openFolder` as `dialog` or `path`, `onCubeChanged`), one adapter per host, and `host`, picked once at load. Web shows "Open folder" as a path field.
- **Guards**: a lint rule in `apps/web/eslint.config.ts` bans `window.desktop` and `import.meta.hot` outside `src/host/`. The cube flows (two cubes, offline from the menu, import into a new cube) live once in `apps/web/e2e/flows/cubes.ts` and run in both `cubes.spec.ts` (web) and `desktop.spec.ts`. Server tests: `cubes.test.ts`.
- **Gaps**: the web recent list keeps folders deleted since; other write routes don't yet check `Sec-Fetch-Site`; future host differences still rely on review plus the lint rule, not on a capability list.

## Not in scope

- Hosting, accounts, a database. The boundary above is what makes them addable later.

## Done when

- In `pnpm dev`, a cube can be created, switched to, reopened, and made available offline, as in the desktop app. e2e covers it on both hosts, and `pnpm check` fails if a view reads `window.desktop`.
