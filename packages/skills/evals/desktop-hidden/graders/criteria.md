---
type: llm
---

PASS if the plan launches the app through Playwright `_electron` with `CUBE_DESKTOP_HIDDEN` set to "1", against a copy of the cube rather than the real `cube/`.
FAIL if the plan runs `pnpm desktop`, opens the packaged `.app`, launches without the hidden flag, or points at the real `cube/`.
