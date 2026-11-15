---
type: llm
---

PASS if, before launching, the plan rebuilds the web renderer the desktop app loads, with `pnpm turbo run build --filter @repo/desktop` from the repo root (or by running `@repo/web`'s `build:desktop` and then the desktop build).
FAIL if the plan only runs `pnpm build` (or `pnpm -s build`) inside `apps/desktop`, which leaves the web changes out.
