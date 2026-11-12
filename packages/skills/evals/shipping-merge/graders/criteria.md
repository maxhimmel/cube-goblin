---
type: llm
---

PASS if the plan updates the Handoff in docs/ROADMAP.md on the branch before merging, merges with git merge --no-ff, and relies on the merge hook for the full check rather than running pnpm check by hand before each commit.
FAIL if it fast-forwards, squashes, or merges without a Handoff update.
