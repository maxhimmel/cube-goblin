# E2E flakiness (2026-11-16)

Workbench e2e tests that pass alone but fail in the merge hook's `pnpm check`. The user asked for them fixed (2026-11-16) and later asked to stop the stress runs, because they overheat the machine. This note records what was proven, what was fixed, and what is still open.

## Method

- Stress runs: one test with `--repeat-each 24..48 --workers 10..12`, then the whole workbench suite with `--repeat-each 3 --workers 8`, on an 8-core Mac. Spotlight (`mds_stores`) was using about 185% CPU at the same time, and the load average was about 33.
- Evidence came from temporary code that was removed afterwards: board requests, responses, and `cube:changed` websocket frames logged in the test; the browser's `dragstart`, `drop`, and `dragend` events logged from the page; and per-phase timings of each write logged on the server (`runWrite` in `packages/server/src/workbench.ts`).

## Flaky tests seen

| Test                                                                          | Failure                                                                                    | Where                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------- |
| board sections hold dragged cards and survive a reload                        | Shock stays in Section 2 after a drag to the pool; board on disk one save behind after 5 s | stress, full-suite stress |
| a saved filter becomes an Insights block that can chart, hide, and be deleted | `toHaveCount` timed out                                                                    | merge hook                |
| the change log survives a reload and reverts entries singly and in bulk       | `locator.click` hit the 30 s test timeout                                                  | merge hook                |

## Findings

- **`dragTo` drops nothing under load (fixed).** In a failed run the browser logged `dragstart`, then `dragend` with `dropEffect=none` and no `drop`, so no save was sent. Playwright's docs say a page that relies on `dragover` needs at least two mouse moves over the drop target ("hover the drop element, hover the drop element second time, mouse up"); `dragTo` makes one ([Playwright input docs](https://playwright.dev/docs/input#drag-and-drop)). Fix: a `drag` helper in `apps/web/e2e/workbench.spec.ts` that hovers the target twice, plus an ESLint rule in `packages/eslint-config` that bans `dragTo` in `e2e/`. After the fix, 5 of 6 rounds of 30 board-test runs passed with no failures. One round had 10 failures that weren't captured (see Open).
- **Logged writes are slow under load (partly fixed).** Writing the log entry (`recordEdit`) took 978 ms on average and up to 7.1 s per board save; idle it takes about 64 ms. It reads the whole cube twice and looks up every card twice for stats. `ScryfallClient.#byKeys` read cache entries one at a time; reading them in parallel cut the average to 450 ms and the worst case to 1.3 s. Saves run one at a time, so slow saves leave the disk seconds behind the screen, and assertions that poll the disk for 5 s time out.
- **E2E edits can call live Scryfall.** The e2e servers share the repo's `.cache/scryfall` (`apps/web/vite.config.ts`), and `FileCache` treats entries older than one day as missing. On 2026-11-16 all 143 fixture cards were fresh, so no test went to the network. On a day when they're stale, every logged edit in a test fetches cards from Scryfall.

- **Smaller e2e cube (done, user's idea).** The fixture went from 143 cards to 45: every card a test names, both cuts, prospect creatures, drafted 2/2s, and a drafted card per color at mana values 1 to 3. Per-edit work and the per-test fixture copy shrink with it. The workbench suite went from 47–90 s to 30 s with all 68 passing. Whether this also clears the open flakes below is not yet proven over many runs.

## Open

- The merge hook's run after these fixes still failed twice. The change-log test hit its 30 s timeout again (not investigated). "The add panel opens over any view" then failed every time, even alone: a real bug, not load. React's `autoFocus` focused the search box before the parent's effect called `showModal()`, whose dialog focusing steps could move focus away. Fixed by focusing the box right after `showModal()` (`apps/web/src/workbench/add-panel.tsx`).
- "a cube folder opens by its path" (`apps/web/e2e/cubes.spec.ts`) failed once in the merge hook: the cube menu wasn't visible within 5 s (line 21). It passed alone. Not investigated.
- Saved-filter and change-log failures: not reproduced. Both passed 40 of 40 runs at 8 workers when run alone, and weren't traced. Slow logged writes are the likely cause, but this isn't proven.
- One round of the board test had 10 failures after the drag fix, during heavy machine load. Their output wasn't kept.
- Ideas, not tried: keep parsed cards in memory in front of `FileCache`; reuse the previous entry's after-stats as the next edit's before-stats; give e2e a seeded cache that doesn't expire; have disk assertions wait for the top bar's "Saved" state first.
- Unverified hypothesis: `loadBoard` (`apps/web/src/workbench/board.ts`) assigns `confirmed` when its GET resolves, even after `cancelQueries`, so a late GET could overwrite newer state. No trace showed this happening.
