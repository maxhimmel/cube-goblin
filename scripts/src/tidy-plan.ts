export interface Worktree {
  path: string;
  branch: string | undefined;
}

export interface TidyPlan {
  branches: string[];
  worktrees: string[];
  blocked: string[];
}

export type Git = (...args: string[]) => Promise<string>;

export function parseWorktrees(porcelain: string): Worktree[] {
  return porcelain
    .split("\n\n")
    .map((block) => block.trim())
    .filter((block) => block !== "")
    .map((block) => {
      const lines = block.split("\n");
      const path = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
      const ref = lines.find((line) => line.startsWith("branch "))?.slice("branch ".length);
      return { path: path ?? "", branch: ref?.replace(/^refs\/heads\//u, "") };
    });
}

export function mergedTips(mergeParents: string): Set<string> {
  return new Set(
    mergeParents
      .split("\n")
      .map((line) => line.trim().split(/\s+/u).slice(1))
      .flat()
      .filter((hash) => hash !== ""),
  );
}

export function selectMerged(
  branches: ReadonlyMap<string, string>,
  tips: ReadonlySet<string>,
  keep: ReadonlySet<string>,
): string[] {
  return [...branches]
    .filter(([name, tip]) => !keep.has(name) && tips.has(tip))
    .map(([name]) => name)
    .sort();
}

export async function planTidy(git: Git, trunk = "main"): Promise<TidyPlan> {
  const tips = mergedTips(await git("log", "--first-parent", "--merges", "--format=%P", trunk));
  const refs = await git("for-each-ref", "--format=%(refname:short) %(objectname)", "refs/heads");
  const branches = new Map(
    refs
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => line.split(" ") as [string, string]),
  );
  const worktrees = parseWorktrees(await git("worktree", "list", "--porcelain"));
  const [primary, ...linked] = worktrees;
  const keep = new Set([trunk]);
  if (primary?.branch !== undefined) {
    keep.add(primary.branch);
  }
  const plan: TidyPlan = { branches: [], worktrees: [], blocked: [] };
  for (const name of selectMerged(branches, tips, keep)) {
    const holder = linked.find((worktree) => worktree.branch === name);
    if (holder === undefined) {
      plan.branches.push(name);
      continue;
    }
    const dirty = await git("-C", holder.path, "status", "--porcelain");
    if (dirty === "") {
      plan.worktrees.push(holder.path);
      plan.branches.push(name);
    } else {
      plan.blocked.push(`${name} (uncommitted changes in ${holder.path})`);
    }
  }
  return plan;
}
