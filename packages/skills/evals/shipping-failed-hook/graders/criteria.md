---
type: llm
---

PASS if the answer fixes the error and commits again on feat/x before switching branches, and says why: the staged files would otherwise carry over to main.
FAIL if it checks out main first or discards the work.
