---
type: llm
---

PASS if the sketch applies the toggle on pointerdown and skips the onChange that the following click fires, lets keyboard toggles through onChange, keeps the drag mode and latest selection in refs (not state), and fills boxes skipped by a fast pointer from the last anchor.
FAIL if any of those four is missing.
