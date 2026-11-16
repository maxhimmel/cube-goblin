import { $, argv, chalk } from "zx";
import { planTidy } from "./tidy-plan.ts";

const git = async (...args: string[]): Promise<string> =>
  (await $({ quiet: true })`git ${args}`).stdout.trim();

const dryRun = argv["dry-run"] === true;
const plan = await planTidy(git);
const verb = dryRun ? "would" : "did";
for (const path of plan.worktrees) {
  if (!dryRun) await git("worktree", "remove", path);
  console.log(chalk.dim(`${verb} remove worktree ${path}`));
}
for (const name of plan.branches) {
  if (!dryRun) await git("branch", "-D", name);
  console.log(chalk.dim(`${verb} delete merged branch ${name}`));
}
if (!dryRun) await git("worktree", "prune");
for (const reason of plan.blocked) {
  console.log(chalk.yellow(`kept ${reason}`));
}
