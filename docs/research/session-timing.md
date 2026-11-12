# Session timing (2026-11-12)

Where agent session time went in this repo, measured from the Claude Code transcripts of 19 sessions (2026-11-08 to 2026-11-12, about 22 active hours). The user asked why commits and tests took so long.

## Method

- Each tool call's duration is the time from its `tool_use` to its `tool_result` in the transcript (`~/.claude/projects/<repo>/*.jsonl`). Bash calls are sorted by command: `git commit` (the pre-commit hook ran `pnpm check`), e2e (`playwright test`), `pnpm check`, and so on.
- Failures were found by matching output text (exit codes, `✘`, `✖`), so failure counts are approximate. One Bash call sometimes held several commits and a merge. Time waiting for the user's answers is left out.
- Task timings come from `turbo run <task> --filter=@repo/web --force --only` on an 8-core Mac.

## Findings

| Tool calls (main sessions)           | Calls |  Total | Median | Failed       |
| ------------------------------------ | ----: | -----: | -----: | ------------ |
| `git commit` (hook ran `pnpm check`) |   285 |  3.9 h |   43 s | 30, 21.5 min |
| e2e run by the agent                 |   211 |  1.4 h |   10 s | about 36%    |
| `pnpm check` run by the agent        |    44 |  0.8 h |   43 s | about 32%    |
| `sleep` and polling                  |    56 | 13 min |    5 s |              |

- Commits were 42% of all tool time. Commits plus e2e and checks were about 28% of active session time.
- Uncached task cost for `@repo/web`: `e2e:workbench` 78 s, lint 9 s, typecheck 3.5 s, `e2e:share` 2.9 s, build 0.8 s, unit tests 0.6 s. A fully cached `pnpm check` took 8.7 s, so a commit after any web edit cost about 90 s, nearly all of it e2e.
- `e2e:workbench` ran 53 tests in `mode: "serial"` on one worker, sharing a worker-scoped fixture. Tests depended on earlier tests' edits, so `-g` on a later test failed on its own ("the change log survives a reload…" failed 4 times this way). 180 of the 211 e2e runs were full-suite runs (69 min).
- Failure causes in commit and check output: e2e 16 (12.7 min), prettier 10 (7.2 min), roadmap/ticket guard 8 (5.3 min), cube data guard 4 (3.5 min), commitlint 3 (3.2 min, "T-039" in a subject failed `subject-case`), markdownlint 3, and the eslint/`test-results` race (fixed 2026-11-12).
- The pre-commit hook checked the working tree, not the staged change, so unstaged edits failed unrelated commits (the roadmap guard failures).
- The roadmap's Handoff "State" bullet was 1,556 words, read at every session start, and repeated the tickets.
- `.claude/skills` was empty, so repeated lessons (order-dependent e2e, the lint race, a React checkbox gotcha) were relearned.
- Worst single waits: a `pnpm fix && pnpm check` that hit the 600 s tool timeout (2026-11-11); commits of 202 s, 190 s, 165 s, 162 s, and 156 s; a 207 s full e2e run to check one test.

## Changes made

The user asked for all of these (2026-11-12):

1. Pre-commit runs fast checks; the full `pnpm check` runs before a merge commit ([tooling.md](tooling.md#git-hooks-lefthook)).
2. Pre-commit per-file checks run on staged files only.
3. E2e tests each get their own cube copy and run in parallel.
4. The Handoff is short and points to tickets.
5. Commitlint allows ticket ids in subjects.
6. Project skills hold the repeated lessons.
