---
name: shipping
description: Commit, merge, and hand off work in this repo. Use when committing, merging a branch into main, committing the user's cube data, or ending a session.
---

# Shipping

The hooks in `lefthook.yml` do the checking; let them.

## Commit

1. Work on a `<type>/<slug>` branch.
2. Stage the files of one logical change by path (`git add <paths>`), then `git commit`. The pre-commit hook checks the staged files in a few seconds (jobs in `lefthook.yml`); its output is the verdict.
3. Subject: conventional, lowercase after the type; a leading ticket id is fine (`docs(log): T-039 notes`).
4. Done when `git log -1` shows the commit. A failed hook leaves the files staged: fix and commit again before any `git checkout`, because staged changes travel with you to the next branch.

## Merge

1. On `main`: `git merge --no-ff <branch> -m "Merge branch '<branch>'"`. The `pre-merge-commit` hook runs the full `pnpm check`, e2e included; a failure stops the merge, so fix it on the branch. After the merge, the `post-merge` hook runs `pnpm tidy`, which deletes every branch a merge brought into `main` and removes its worktree if clean; `pnpm tidy --dry-run` previews.
2. The branch updates the Handoff in `docs/ROADMAP.md` before merging: current state and next step only, under 200 words, details in tickets. Merges of `cube/` data alone skip this.

## The user's cube data

The user's server writes `cube/` (cards, `log.jsonl`, board, filters). Commit those as `chore(cube): ...` on a `chore/<slug>` branch, alone, and merge.

## End of session

Run `pnpm handoff` until it prints SAFE TO CLOSE, then tell the user.
