---
name: workbench-testing
description: Verify a workbench change by running it. Use when checking a UI change in a dev server, screenshotting a view, seeding cube data or log entries, or writing and running workbench e2e tests.
---

# Workbench testing

Prove a change by looking at it, on a **copy** of the cube. The user's own server on port 5173 runs against the real `cube/`; leave it and its data alone.

## Run a dev server on a copy

1. `mkdir -p /tmp/<slug> && cp -R cube /tmp/<slug>/cube`
2. From `apps/web`, start it in the background: `CUBE_REPO_ROOT=/tmp/<slug> pnpm exec vite --configLoader runner --port <free port> --strictPort`.
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
