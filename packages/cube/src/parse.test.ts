import { describe, expect, it } from "vitest";
import { parseBatch } from "./parse.ts";

describe("parseBatch", () => {
  it("strips bullets and skips blanks", () => {
    expect(parseBatch(["[  ] Shock ", "", "[ ] Opt", "[x] Chart a course"].join("\n"))).toEqual([
      { line: 1, input: "[  ] Shock ", name: "Shock" },
      { line: 3, input: "[ ] Opt", name: "Opt" },
      { line: 4, input: "[x] Chart a course", name: "Chart a course" },
    ]);
  });
});
