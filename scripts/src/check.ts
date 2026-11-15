import { $ } from "zx";
import { cubeArgs } from "./cube-option.ts";
import { forbidShellScripts, runSteps } from "./repo.ts";

const cube = cubeArgs();

process.exitCode = await runSteps([
  { name: "no shell scripts", run: forbidShellScripts },
  { name: "format", run: () => $`pnpm exec prettier --check .` },
  { name: "markdown", run: () => $`pnpm exec markdownlint-cli2` },
  { name: "roadmap + tickets", run: () => $`pnpm exec tsx scripts/src/check-roadmap.ts` },
  { name: "cube data", run: () => $`pnpm -s cube validate ${cube}` },
  { name: "share doc snapshot", run: () => $`pnpm -s cube snapshot ${cube}` },
  {
    name: "lint + typecheck + test + build + e2e",
    run: () => $`pnpm exec turbo run lint typecheck test build e2e:workbench e2e:share e2e:desktop`,
  },
]);
