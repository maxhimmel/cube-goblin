import { join } from "node:path";
import { chalk } from "zx";
import { REPO_ROOT } from "./repo.ts";
import { loadRoadmap, validateRoadmap } from "./roadmap.ts";

const { roadmap, tickets } = await loadRoadmap(join(REPO_ROOT, "docs"));
const problems = validateRoadmap(roadmap, tickets);
for (const problem of problems) {
  console.error(chalk.red(problem));
}
console.log(`${String(tickets.length)} tickets, ${String(problems.length)} problems`);
process.exitCode = problems.length > 0 ? 1 : 0;
