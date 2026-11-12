---
type: llm
---

PASS if the test seeds its own section (through the API or a helper such as seedBurn) instead of relying on state from another test, and the plan runs the new test alone with playwright's -g.
FAIL if the test depends on another test having run first, or the plan only runs the whole suite.
