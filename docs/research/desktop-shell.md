# Desktop shell (Electron): research

Researched 2026-11-15. Versions from `npm view` on that date. Context: the workbench runs today as a Vite dev-server plugin ([rendering-and-sharing.md](rendering-and-sharing.md#workbench-dev-server-2026-11-08)); this covers moving it into an Electron app.

## Electron

- **Version**: `electron` 45.3.2 on npm (`latest`); 46 is in alpha. 45.0.0 shipped 2026-10-21 with Chromium 156, Node 24.22, V8 15.6. 42.x is now end-of-support ([45 blog](https://www.electronjs.org/blog/electron-45-0)). The releases site already lists 45.3.3 (2026-11-14) before npm ([releases](https://releases.electronjs.org/release?channel=stable)).
- **ESM, main**: Node's ESM loader, picked by `.mjs` or `"type": "module"`. ESM loads async: only static imports of the entry run before `ready`; `await` dynamic `import()`s, or calls like `app.setPath` land too late ([ESM](https://www.electronjs.org/docs/latest/tutorial/esm)).
- **ESM, preload**: a sandboxed preload can't be ESM. It runs as plain script and must be one bundled file. Unsandboxed preloads can be ESM but must end in `.mjs`; they ignore `"type": "module"` ([ESM](https://www.electronjs.org/docs/latest/tutorial/esm)).
- **Sandboxed preload limits**: `require` loads only `electron` (and `electron/renderer`, `electron/common`), which exposes `contextBridge`, `ipcRenderer`, `webFrame`, `webUtils`, `nativeImage`, `crashReporter`. `process` is reduced and there are no Node built-ins. Sandboxing has been the default since Electron 20 ([sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox)). Since 45, `Buffer`, `setImmediate`, and the `events`/`timers`/`url` shims are gone too ([45 blog](https://www.electronjs.org/blog/electron-45-0)).
- **Renderer**: Chromium's ESM loader, so no `node:*` imports and no bare `node_modules` imports; a bundler is required ([ESM](https://www.electronjs.org/docs/latest/tutorial/esm)).

## Build tooling

- **electron-vite 6.0.0** (2026-10-15): peer `vite ^6 || ^7 || ^8`, built against `vite ^8.3.1` (`npm view`); the changelog has "update vite to v8" ([CHANGELOG](https://github.com/alex8088/electron-vite/blob/master/CHANGELOG.md)). One `electron.vite.config.*` with `main`/`preload`/`renderer` keys, renderer HMR, and main/preload hot reload. Needs Node 20.19+ or 22.12+ ([guide](https://electron-vite.org/guide/)). It doesn't package; its docs show electron-builder ([distribution](https://github.com/alex8088/electron-vite-docs/blob/master/packages/en-US/docs/guide/distribution.md)).
- **Forge Vite plugin** (`@electron-forge/plugin-vite` 8.0.1, 2026-09-29): no Vite peer dep; its own repo builds against `vite ^8.0.0` ([package.json](https://github.com/electron/forge/blob/main/packages/plugin/vite/package.json)). It has been marked **experimental** since Forge 7.5, so minor releases may break ([Vite plugin](https://www.electronforge.io/config/plugins/vite)). Forge packaging walks `node_modules` naively, so pnpm users must set `node-linker=hoisted` ([Forge docs](https://www.electronforge.io/llms-full.txt), "Packaging requires node_modules to be on disk"). That setting would change the whole monorepo.
- **Plain Vite + electron-builder**: possible, but we'd hand-write what electron-vite already does: three builds, starting Electron after the dev server is up, restarting main on change.
- **electron-builder**: `latest` 26.18.0, `next` 27.0.0-alpha.14. The master docs describe v27, which moves signing keys under `mac.sign`; 26.18's schema accepts both `mac.identity` and `mac.sign` (checked in the `app-builder-lib@26.18.0` tarball) ([mac docs](https://github.com/electron-userland/electron-builder/blob/master/website/docs/mac.md)). Several pnpm fixes (hoisted workspaces, isolated store, `link:` deps) are still unreleased changesets on master ([.changeset](https://github.com/electron-userland/electron-builder/tree/master/.changeset)).

## Security baseline

From Electron's checklist ([security](https://www.electronjs.org/docs/latest/tutorial/security)) unless noted:

- **Keep the defaults**: `nodeIntegration: false` (since 5), `contextIsolation: true` (since 12; turning it off also turns off the sandbox), `sandbox: true` (since 20). Don't touch `webSecurity`, `allowRunningInsecureContent`, `experimentalFeatures`, or `enableBlinkFeatures`.
- **CSP**: use a strict policy. Prefer the response header (`webRequest.onHeadersReceived`, or headers on our `protocol.handle` responses); a `<meta>` tag only where headers can't be set.
- **contextBridge**: expose small named functions, never `ipcRenderer` itself or its `on`/`send`/`invoke`. Don't hand the callback straight to `ipcRenderer.on`, since `event.sender` leaks `ipcRenderer`; wrap it and pass only the data ([IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)). Values are copied and frozen and prototypes are dropped. Functions and promises are proxied, and errors lose custom properties ([contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge)).
- **Check the IPC sender**: in every `ipcMain.handle`, check `event.senderFrame` (its origin) against an allowlist. It can be `null` once the frame has navigated or been destroyed ([IpcMainInvokeEvent](https://www.electronjs.org/docs/latest/api/structures/ipc-main-invoke-event)).
- **Custom protocol instead of `file://`**: `file://` pages can read any local file. Register the scheme with `protocol.registerSchemesAsPrivileged` (once, before `ready`; flags `standard`, `secure`, `supportFetchAPI`, `codeCache`), then call `protocol.handle` after `ready`. The docs' example serves `app://bundle/` through `net.fetch(pathToFileURL(...))` and returns 400 for paths that resolve outside the bundle. For access decisions, use `request.initiatorOrigin` rather than `referrer` ([protocol](https://www.electronjs.org/docs/latest/api/protocol)).
- **Navigation and windows**: `will-navigate` + `preventDefault` with parsed-origin comparison; `setWindowOpenHandler` deny by default; `shell.openExternal` only with trusted URLs (Scryfall links: allowlist the host).
- **Permissions**: Electron grants permission requests by default; deny everything with `session.setPermissionRequestHandler`.
- **Fuses**: use `@electron/fuses` (2.1.3) to turn off `runAsNode` and `nodeCliInspect` in packaged builds. But Playwright's launch needs `EnableNodeCliInspectArguments` ([Playwright](https://playwright.dev/docs/api/class-electron)), so keep it on in the e2e build.

## Replacing `/api/*`

- **IPC (`invoke`/`handle`)**: typed per channel, sender checks per call. Payloads go through structured clone, and a rejected `handle` reaches the renderer as the error `message` only ([IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)). `apps/web/src/workbench/api.ts` would need a second transport behind every function, and `<img src>` can't use IPC.
- **HTTP server in main**: works unchanged with `fetch`, but it opens a localhost port any local process can reach, and we'd need a token. Nothing in the checklist recommends it.
- **Custom protocol serving `/api` too**: `protocol.handle` takes a `Request` and returns a `Response`, the same contract as `fetch`. If the renderer loads from `app://bundle/`, the relative `/api/...` URLs in `api.ts` and the `/api/image?u=` image URLs resolve to the handler with no client changes. `supportFetchAPI` is required ([protocol](https://www.electronjs.org/docs/latest/api/protocol)). In 45, `net.fetch` responses passed through untouched skip JavaScript, so serving cached image files is cheap ([45 blog](https://www.electronjs.org/blog/electron-45-0)).
- **Shared core**: pull the routes in `server/workbench-plugin.ts` into a `(Request) => Promise<Response>` handler in a package. Mount it from Vite middleware for the browser dev server and from `protocol.handle` in Electron. The data layer stays fetch-based, so the browser dev server and Electron run the same code.
- **Push "cube changed"**: main → `win.webContents.send("cube:changed")`; preload exposes `onCubeChanged(cb)` that wraps `ipcRenderer.on` and returns an unsubscribe ([IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)). The client listens to that or `import.meta.hot.on`, whichever exists.
- **Watching**: chokidar 6.0.0 (2026-10) is a rewrite: ESM-only since v5, Node 22.22+ (Electron 45's Node 24.22 qualifies), `fs.watch` recursive backend on macOS, no globs (use RegExp/functions in `ignored`), and a watcher can't be reopened after `close()`. Its README covers raw `fs.watch` problems: opaque `rename` events, double fires, recursion that differs by platform ([README](https://github.com/paulmillr/chokidar#readme)).

## Folders, settings, paths

- **Folder picker**: `dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] })` resolves `{ canceled, filePaths }`. `createDirectory` is macOS-only; Windows has `promptToCreate`. Passing a window shows a sheet on macOS. `securityScopedBookmarks` matters only for MAS builds ([dialog](https://www.electronjs.org/docs/latest/api/dialog)).
- **Paths**: `userData` defaults to `appData` + app name (`~/Library/Application Support/<name>`). `sessionData` defaults to `userData` and must be overridden before `ready`. `documents` is the user's documents folder. `app.addRecentDocument` feeds the macOS dock menu ([app](https://www.electronjs.org/docs/latest/api/app)).
- **electron-store 12.0.0**: ESM-only, Electron 35+, Node 22+, wraps `conf` 16. It saves `config.json` in `userData` and rewrites the whole file on every change, so it suits small settings only. It can't run in a sandboxed preload, so keep it in main and expose it via IPC. Schema validation uses ajv, which may conflict with a strict CSP ([README](https://github.com/sindresorhus/electron-store#readme)).

## Offline and networking

- **`net.fetch`**: goes through Chromium's network stack and the default session (`ses.fetch` for others). It handles custom protocols and `file:`, and triggers `webRequest` handlers. It doesn't support `data:`/`blob:`, ignores `integrity`, and returns wrong `Response.type`/`url`. Only usable after `ready` ([net](https://www.electronjs.org/docs/latest/api/net)). Node's global `fetch` in main uses Node's HTTP stack instead ([session](https://www.electronjs.org/docs/latest/api/session)).
- **Cache**: neither page says whether `net.fetch` uses the session HTTP cache. `ses.clearCache()` and `getCacheSize()` exist ([session](https://www.electronjs.org/docs/latest/api/session)). Our own caches (`packages/scryfall` JSON, `ImageCache` files) don't depend on it, so leave them pointed at the cube/`userData` dirs.
- **Online state**: `net.isOnline()`/`net.online` in main and `navigator.onLine` in the renderer. `false` reliably means offline; `true` proves nothing (virtual adapters report "connected"), so treat a failed request as the real signal ([net](https://www.electronjs.org/docs/latest/api/net), [online/offline](https://www.electronjs.org/docs/latest/tutorial/online-offline-events)).

## Packaging and testing

- **Unsigned arm64 mac**: `electron-builder --mac dir --arm64` (or `zip`/`dmg`). Skip signing with `mac.identity: null` (v27: `mac.sign.identity: null`) or `CSC_IDENTITY_AUTO_DISCOVERY=false`. With no certificate in the keychain, signing is skipped; there's no automatic ad-hoc signature. Unsigned apps on Apple Silicon run after approval in System Settings → Privacy & Security. `identity: "-"` gives an ad-hoc signature that runs only on the build machine ([mac code signing](https://github.com/electron-userland/electron-builder/blob/master/website/docs/features/code-signing/code-signing-mac.md)). Turn off hardened runtime when unsigned ([mac docs](https://github.com/electron-userland/electron-builder/blob/master/website/docs/mac.md)).
- **Playwright `_electron`**: still **experimental**, Electron 21+. `electron.launch({ args: ["out/main/index.js"], executablePath? })`, then `firstWindow()`, `evaluate(({ app }) => ...)` in main, `close()`. `chromiumSandbox` defaults to `false`, and `offline: true` emulates offline ([Playwright](https://playwright.dev/docs/api/class-electron)). Electron's testing guide runs it in development mode ([automated testing](https://www.electronjs.org/docs/latest/tutorial/automated-testing)). `@playwright/test` 1.65.1 is current (repo pins 1.65.0).

## Gotchas

- **Workspace `.ts` packages get externalized**: electron-vite externalizes everything in `dependencies` for main and preload ([dependency handling](https://electron-vite.org/guide/dependency-handling)). `@repo/cube` and `@repo/scryfall` export `.ts`, so Node would hit `ERR_UNKNOWN_FILE_EXTENSION` at runtime, the same failure Vite's config loader hits today. Bundle them with `build.externalizeDeps.exclude` (or list them in `devDependencies`, which get bundled).
- **pnpm packaging**: electron-vite's troubleshooting page suggests `shamefully-hoist=true` for "Cannot find module" after packaging ([troubleshooting](https://github.com/alex8088/electron-vite-docs/blob/master/packages/en-US/docs/guide/troubleshooting.md)); Forge requires `node-linker=hoisted`. We can avoid both: give the desktop package no runtime `dependencies` (bundle everything into main), so the packager collects nothing from `node_modules`. Not yet verified.
- **`"type": "module"` makes the preload ESM**: in a `"type": "module"` package, electron-vite emits the preload as `.mjs` ESM ([dev guide](https://github.com/alex8088/electron-vite-docs/blob/master/packages/en-US/docs/guide/dev.md#esm-support-in-electron)), which won't load in a sandbox. Force the preload output format to `cjs` and keep it to one file.
- **electron-vite 6 build targets** list Electron 42–44 ([CHANGELOG](https://github.com/alex8088/electron-vite/blob/master/CHANGELOG.md)). Check what target it picks for 45.
- **Dev vs prod origin**: in dev the renderer loads from the Vite server (`http://localhost`), not `app://`, so relative `/api` URLs hit Vite. Either keep the shared handler mounted in that Vite server too, or give `api.ts` a base URL. Cross-scheme `fetch` to `app://` needs the `corsEnabled` privilege plus CORS headers. Prototype this.
- **`keepalive` fetches** (`sendJson` in `api.ts`) through a custom scheme: no Electron docs on this. Test that a save on window close still lands.
- **ESM main timing**: anything that must run before `ready` (`registerSchemesAsPrivileged`, `setName`, `setPath("sessionData")`) has to sit in the entry's static import graph ([ESM](https://www.electronjs.org/docs/latest/tutorial/esm)).

## Spike results (2026-11-15)

Built under [T-056](../tickets/T-056-desktop-app.md); `apps/desktop/e2e/desktop.spec.ts` covers the first four.

- **One scheme works end to end**: `app://bundle` serves `apps/web/dist-desktop` and `@repo/server`'s handler (`apps/desktop/src/main/index.ts`). Relative `/api` fetches, `/api/image` images, and request bodies need no client changes.
- **`keepalive` over the custom scheme works**: notes typed right before a reload land on disk.
- **Dev origin, sidestepped**: `pnpm desktop` builds the renderer once and loads it over `app://` in dev too, so there is no localhost origin. Renderer HMR stays in the browser (`pnpm dev`).
- **Playwright `_electron`** runs against `out/` (dev build) in `pnpm check`.
- **electron-vite target**: its table stops at Electron 44 and falls back to `node24.18` for 45; harmless. It warns "renderer config is missing", which is expected.
- **Preload**: `rolldownOptions.output.format: "cjs"` plus `entryFileNames: "[name].cjs"` keeps it one sandboxed CJS file inside a `"type": "module"` package.
- **Packaging with no runtime `dependencies`** works: electron-builder finds no `node_modules` and needs no pnpm hoisting. The renderer ships as `extraResources`. The `.app` is 260 MB.
- **Fuses on arm64** need `resetAdHocDarwinSignature: true` (electron-builder `electronFuses`) when unsigned, or the edited binary won't launch. With `enableNodeCliInspectArguments: false`, Playwright can't drive the packaged app; it was smoke-tested by hand before the fuses went on.

## Recommendation

- **electron-vite 6 + electron-builder 26** in a new `apps/desktop` package. electron-vite is the only option that declares Vite 8 support, it's stable rather than experimental, and it builds main, preload, and renderer from one config. electron-builder doesn't force `node-linker=hoisted` on the monorepo.
- **Bundle everything**: workspace packages, chokidar, and electron-store all go into main; no runtime `dependencies`. The preload is one sandboxed CJS file.
- **One custom scheme** (`app://bundle`) serves the renderer, `/api/*`, and `/api/image` through a shared `Request → Response` handler pulled out of `workbench-plugin.ts`. The browser dev server keeps working through the same handler.
- **IPC only for native needs**: folder picker, recent folders and settings, `cube:changed` push. Each is a named `contextBridge` function, and every handler checks the sender.
- **Spike first**: one window serving `GET /api/cube` over `app://`, watch → push working, an unsigned `--mac dir --arm64` build launched, and one Playwright `_electron` test. Then port the remaining routes.

## Offline testing

Read 2026-11-15 from [net](https://www.electronjs.org/docs/latest/api/net#netfetchinput-init).

- `net.fetch` sends requests through Chromium's network stack from the default session, and they trigger that session's `webRequest` handlers. Node's `fetch` in main doesn't.
- So the e2e cuts Scryfall with `session.defaultSession.webRequest.onBeforeRequest({ urls: ["*://*.scryfall.com/*", "*://*.scryfall.io/*"] }, … cancel)`, which leaves `app://` alone. Verified: the cancelled `net.fetch` rejects and the server goes offline.
