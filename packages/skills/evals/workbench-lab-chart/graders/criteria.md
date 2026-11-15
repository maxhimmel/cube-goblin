---
type: llm
---

PASS if the plan runs a dev server against a copy of cube/ (CUBE_DIR pointing at a temp copy) on a port other than 5173, makes the cuts through the HTTP API (PATCH /api/cards) rather than editing files, turns every Lab block on before judging the chart, and stops the server and removes the copy at the end.
FAIL if it edits the real cube/ files, uses the user's server on 5173, or skips any of those points.
