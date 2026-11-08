import { $ } from "zx";
import { forbidShellScripts, runSteps } from "./repo.ts";

process.exitCode = await runSteps([
  { name: "no shell scripts", run: forbidShellScripts },
  { name: "format", run: () => $`pnpm exec prettier --check .` },
  { name: "markdown", run: () => $`pnpm exec markdownlint-cli2` },
  { name: "lint + typecheck + test", run: () => $`pnpm exec turbo run lint typecheck test` },
]);
