---
name: workbench-testing
description: Verify a workbench change by running it. Use when checking a UI change in a dev server, screenshotting a view, seeding cube data or log entries, or writing and running workbench e2e tests.
---

# Workbench testing

Prove a change by looking at it, on a **copy** of the cube. The user's own server on port 5173 runs against the real `cube/`; leave it and its data alone.

## Run a dev server on a copy

1. `mkdir -p /tmp/<slug> && cp -R cube /tmp/<slug>/` (the cube folder holds its own `cube.config.json`)
2. From `apps/web`, start it in the background: `CUBE_DIR=/tmp/<slug>/cube pnpm exec vite --configLoader runner --port <free port> --strictPort`.
3. Seed through the HTTP API, never by editing files under the copy while the server runs:
   - Card edits: `PATCH /api/cards` with `{"changes":[{"slug":"shock","patch":{"status":"prospect"}}]}`.
   - A log entry gets its subject and why from the `X-Log-Subject` and `X-Log-Body` headers (URI-encoded).
   - Board: `PUT /api/board`; filters: `PUT /api/filters`.
4. Done when the server is stopped (`lsof -ti tcp:<port> | xargs kill`) and `/tmp/<slug>` removed.

## Look at it

- Drive Chromium with a throwaway script saved inside `apps/web` (so `@playwright/test` resolves), run with `node`, deleted right after. Screenshots go to `/tmp/<slug>/`; read them back.
- In the Lab, turn every block on from the Blocks menu first: the user has hidden some.
- Check the narrow (about 900px) and wide (1280px and up) layouts when a change touches layout.

## E2E tests (`apps/web/e2e/workbench.spec.ts`)

- Every test starts from a fresh copy of `e2e/fixture/cube` (the `freshCube` fixture), on 4 workers. Seed what a test needs through the API in the test itself (`seedBurn`, `draftSlugs`); a test that reads state left by another test is a bug.
- Run one test alone with `pnpm exec playwright test workbench.spec.ts -g "<title>"` from `apps/web`.
- The add-card test calls Scryfall live and takes 6 to 8 seconds.
- A new or changed test is done when it passes alone with `-g`. The whole suite runs in the merge hook's `pnpm check`; that merge is where "`pnpm check` passes" is proven.

## Desktop app (`apps/desktop`)

The user is working on the same screen. Never let a window appear, take focus, or add a Dock icon.

- Launch it only through Playwright `_electron` with `CUBE_DESKTOP_HIDDEN: "1"` in `env` (the window is never shown and the Dock icon is hidden; screenshots still render). Point `CUBE_DIR` at a copy of the cube folder, and `CUBE_USER_DATA` and `CUBES_HOME` (where "New cube" makes folders) at `/tmp` folders.
- Never run `pnpm desktop` or launch the packaged `.app`; those are for the user.
- Throwaway scripts go inside `apps/desktop` (so `@playwright/test` resolves) and run after `pnpm -s turbo run build --filter @repo/desktop` from the repo root. It rebuilds the web renderer (`apps/web/dist-desktop`) and `out/`; `pnpm build` inside `apps/desktop` alone leaves web changes out.
- E2E: `apps/desktop/e2e/desktop.spec.ts`, run from `apps/desktop` with `pnpm exec playwright test`; its fixture already sets the hidden flag.
