import { describe, expect, it } from "vitest";
import { isSectionHeader, parseBatch } from "./parse.ts";

describe("isSectionHeader", () => {
  it.each([":pirate_flag:🪎", ":bat::drop_of_blood:", ":t-rex::bone:", "🦖🦴", ":merman::ocean:"])(
    "treats %s as a header",
    (text) => {
      expect(isSectionHeader(text)).toBe(true);
    },
  );

  it.each(["Shock", "It doesn't add up", "Tom bert and William", "Opt 🪎"])(
    "treats %s as a card",
    (text) => {
      expect(isSectionHeader(text)).toBe(false);
    },
  );
});

describe("parseBatch", () => {
  it("strips bullets, skips blanks, and assigns sections", () => {
    const parsed = parseBatch(
      ["[  ] Shock ", "", "[ ] Opt", "[  ] :pirate_flag:🪎", "[  ] Chart a course"].join("\n"),
    );
    expect(parsed.headers).toEqual([":pirate_flag:🪎"]);
    expect(parsed.entries).toEqual([
      { line: 1, input: "[  ] Shock ", name: "Shock", sectionHeader: undefined },
      { line: 3, input: "[ ] Opt", name: "Opt", sectionHeader: undefined },
      {
        line: 5,
        input: "[  ] Chart a course",
        name: "Chart a course",
        sectionHeader: ":pirate_flag:🪎",
      },
    ]);
  });
});
