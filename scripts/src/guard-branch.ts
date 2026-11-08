import { $, chalk } from "zx";
import { branchProblem } from "./branch.ts";

const branch = (await $({ quiet: true })`git branch --show-current`).stdout.trim();
const problem = branchProblem(branch);
if (problem) {
  console.error(chalk.red(problem));
  process.exitCode = 1;
}
