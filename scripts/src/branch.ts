export const PROTECTED_BRANCHES = ["main", "master"];
export const BRANCH_TYPES = [
  "feat",
  "fix",
  "docs",
  "build",
  "chore",
  "refactor",
  "test",
  "ci",
  "perf",
  "style",
  "revert",
];
export const BRANCH_PATTERN = new RegExp(`^(${BRANCH_TYPES.join("|")})/[a-z0-9][a-z0-9-]*$`, "u");

export function branchProblem(branch: string): string | undefined {
  if (PROTECTED_BRANCHES.includes(branch)) {
    return `Commits straight to ${branch} are not allowed. Create a branch: git switch -c <type>/<slug>`;
  }
  if (!BRANCH_PATTERN.test(branch)) {
    return `Branch "${branch}" must match <type>/<slug>, type one of: ${BRANCH_TYPES.join(", ")}`;
  }
  return undefined;
}
