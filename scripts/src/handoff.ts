import { join } from "node:path";
import { $, cd, chalk } from "zx";
import { REPO_ROOT } from "./repo.ts";
import { isDataOnly, loadRoadmap, validateRoadmap } from "./roadmap.ts";
import { planTidy } from "./tidy-plan.ts";

cd(REPO_ROOT);
const git = async (...args: string[]): Promise<string> =>
  (await $({ quiet: true })`git ${args}`).stdout.trim();

const problems: string[] = [];

const status = await git("status", "--porcelain");
if (status) {
  problems.push(`Uncommitted changes:\n${status}`);
}

const branch = await git("branch", "--show-current");
if (branch !== "main") {
  problems.push(`On branch '${branch}', not main (merge it with --no-ff first)`);
}

const unmerged = await git("branch", "--no-merged", "main");
if (unmerged) {
  problems.push(`Branches not merged into main: ${unmerged.replace(/\s+/gu, " ").trim()}`);
}

const leftovers = await planTidy(git);
if (leftovers.branches.length > 0 || leftovers.blocked.length > 0) {
  problems.push(
    `Merged branches or worktrees left over (run pnpm tidy): ${[...leftovers.branches, ...leftovers.blocked].join(", ")}`,
  );
}

const stashes = await git("stash", "list");
if (stashes) {
  problems.push(`Stashed work exists:\n${stashes}`);
}

const { roadmap, tickets } = await loadRoadmap(join(REPO_ROOT, "docs"));
problems.push(...validateRoadmap(roadmap, tickets));

const merges = (await git("log", "--first-parent", "--format=%H", "-50", "main")).split("\n");
let lastChange = "";
for (const hash of merges) {
  const touched = (
    await git("show", "--first-parent", "-m", "--name-only", "--format=", hash)
  ).split("\n");
  if (isDataOnly(touched)) {
    continue;
  }
  lastChange = await git("log", "-1", "--format=%h %s", hash);
  if (!touched.includes("docs/ROADMAP.md")) {
    problems.push(
      `Last non-data change on main (${lastChange}) didn't update docs/ROADMAP.md; refresh the Handoff section`,
    );
  }
  break;
}

if (problems.length === 0) {
  console.log(chalk.green.bold("SAFE TO CLOSE"));
  console.log(chalk.dim(`main at ${lastChange}; handoff is in docs/ROADMAP.md`));
} else {
  console.log(chalk.red.bold("NOT SAFE TO CLOSE"));
  for (const problem of problems) {
    console.log(chalk.red(`- ${problem}`));
  }
  process.exitCode = 1;
}
