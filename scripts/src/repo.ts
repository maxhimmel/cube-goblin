import { fileURLToPath } from "node:url";
import { $, cd, chalk, glob } from "zx";

export const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export const SHELL_SCRIPT_GLOBS = ["**/*.{sh,bash,zsh,fish}"];
export const IGNORED = ["**/node_modules/**", "**/.turbo/**", ".omc/**"];

export interface Step {
  name: string;
  run: () => Promise<unknown>;
}

export async function findShellScripts(): Promise<string[]> {
  return glob(SHELL_SCRIPT_GLOBS, { cwd: REPO_ROOT, ignore: IGNORED, dot: true });
}

export async function forbidShellScripts(): Promise<void> {
  const found = await findShellScripts();
  if (found.length > 0) {
    throw new Error(
      `Shell scripts are not allowed; write TypeScript run with zx instead:\n  ${found.join("\n  ")}`,
    );
  }
}

export async function runSteps(steps: readonly Step[]): Promise<number> {
  cd(REPO_ROOT);
  $.verbose = true;
  const failed: string[] = [];
  for (const step of steps) {
    console.log(chalk.bold.cyan(`\n▶ ${step.name}`));
    try {
      await step.run();
      console.log(chalk.green(`✔ ${step.name}`));
    } catch (error) {
      failed.push(step.name);
      console.log(chalk.red(`✖ ${step.name}`));
      if (error instanceof Error && !("exitCode" in error)) {
        console.log(chalk.red(error.message));
      }
    }
  }
  if (failed.length > 0) {
    console.log(chalk.red.bold(`\nFailed: ${failed.join(", ")}`));
    return 1;
  }
  console.log(chalk.green.bold("\nAll checks passed"));
  return 0;
}
