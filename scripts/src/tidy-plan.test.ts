import { describe, expect, it } from "vitest";
import { type Git, mergedTips, parseWorktrees, planTidy, selectMerged } from "./tidy-plan.ts";

describe("mergedTips", () => {
  it("collects every parent after the first", () => {
    expect(mergedTips("m1 a1\nm2 b1 c1\n")).toEqual(new Set(["a1", "b1", "c1"]));
  });
});

describe("parseWorktrees", () => {
  it("reads paths and branches, including detached worktrees", () => {
    const porcelain = [
      "worktree /repo\nHEAD aaa\nbranch refs/heads/main",
      "worktree /tmp/wt\nHEAD bbb\nbranch refs/heads/feat/x",
      "worktree /tmp/detached\nHEAD ccc\ndetached",
    ].join("\n\n");
    expect(parseWorktrees(porcelain)).toEqual([
      { path: "/repo", branch: "main" },
      { path: "/tmp/wt", branch: "feat/x" },
      { path: "/tmp/detached", branch: undefined },
    ]);
  });
});

describe("selectMerged", () => {
  const branches = new Map([
    ["main", "m"],
    ["feat/done", "d"],
    ["feat/fresh", "m"],
    ["feat/more", "x"],
  ]);

  it("picks only branches whose tip a merge brought in", () => {
    expect(selectMerged(branches, new Set(["d"]), new Set(["main"]))).toEqual(["feat/done"]);
  });

  it("never picks a kept branch", () => {
    expect(selectMerged(branches, new Set(["d"]), new Set(["main", "feat/done"]))).toEqual([]);
  });
});

describe("planTidy", () => {
  const answer = (dirty: Record<string, string>, args: string[]): string => {
    const key = args.join(" ");
    if (key.startsWith("log ")) return "m2 m1 done\nm3 m2 held\nm4 m3 busy";
    if (key.startsWith("for-each-ref"))
      return "main m4\nfeat/done done\nfeat/held held\nfeat/busy busy\nfeat/fresh m4";
    if (key.startsWith("worktree list"))
      return [
        "worktree /repo\nHEAD m4\nbranch refs/heads/main",
        "worktree /wt/held\nHEAD held\nbranch refs/heads/feat/held",
        "worktree /wt/busy\nHEAD busy\nbranch refs/heads/feat/busy",
      ].join("\n\n");
    if (args[0] === "-C") return dirty[args[1] ?? ""] ?? "";
    throw new Error(`unexpected git ${key}`);
  };
  const fakeGit =
    (dirty: Record<string, string>): Git =>
    (...args) =>
      Promise.resolve(answer(dirty, args));

  it("removes clean worktrees with their branches and keeps dirty ones", async () => {
    const plan = await planTidy(fakeGit({ "/wt/busy": " M file.ts" }));
    expect(plan).toEqual({
      branches: ["feat/done", "feat/held"],
      worktrees: ["/wt/held"],
      blocked: ["feat/busy (uncommitted changes in /wt/busy)"],
    });
  });
});
