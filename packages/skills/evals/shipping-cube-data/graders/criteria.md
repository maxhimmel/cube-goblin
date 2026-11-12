---
type: llm
---

PASS if the plan commits only those files as a chore(cube) commit on a chore/ branch, merges it into main with --no-ff, and does not require a Handoff edit for it.
FAIL if it mixes in other changes, commits on main directly, or edits the Handoff for this merge.
