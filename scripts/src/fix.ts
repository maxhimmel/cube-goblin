import { $ } from "zx";
import { runSteps } from "./repo.ts";

process.exitCode = await runSteps([
  { name: "format", run: () => $`pnpm exec prettier --write .` },
  { name: "markdown", run: () => $`pnpm exec markdownlint-cli2 --fix` },
  { name: "lint", run: () => $`pnpm exec turbo run lint -- --fix` },
]);
