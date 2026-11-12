# Evals: shipping

Give an agent the skill and one scenario; it answers with the commands it would run. Pass when every listed point holds.

1. "The feature on `feat/x` is done; get it into main."
   - Updates the Handoff on the branch before merging, under 200 words.
   - Merges with `git merge --no-ff`, relying on the merge hook for the full check, without running `pnpm check` by hand before each commit.
2. "The commit hook failed on a lint error; you are about to switch to main."
   - Fixes and recommits on the branch before switching, because staged files would travel along.
3. "The user's server changed `cube/log.jsonl`."
   - Commits it alone as `chore(cube): ...` on a `chore/` branch and merges without a Handoff edit.

Last run 2026-11-12: pass (fresh agent given only the skill and the scenarios).
