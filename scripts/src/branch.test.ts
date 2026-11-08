import { describe, expect, it } from "vitest";
import { branchProblem } from "./branch.ts";

describe("branchProblem", () => {
  it.each(["main", "master"])("rejects protected branch %s", (branch) => {
    expect(branchProblem(branch)).toMatch(/not allowed/u);
  });

  it.each(["feat/card-images", "build/lefthook", "fix/collection-has-more"])(
    "accepts %s",
    (branch) => {
      expect(branchProblem(branch)).toBeUndefined();
    },
  );

  it.each(["lefthook", "feature/x", "feat/Card", "feat/", "feat/a_b"])("rejects %s", (branch) => {
    expect(branchProblem(branch)).toMatch(/must match/u);
  });
});
