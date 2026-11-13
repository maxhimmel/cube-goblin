import { describe, expect, it } from "vitest";
import {
  CARD_FUNCTIONS,
  FUNCTION_TAGS,
  functionTags,
  producesFixing,
  withFunctionTags,
} from "./functions.ts";

const removal = CARD_FUNCTIONS.find((entry) => entry.id === "removal")?.oracleTagId ?? "";
const fetchland = CARD_FUNCTIONS.find((entry) => entry.id === "fixing")?.oracleTagId ?? "";

describe("producesFixing", () => {
  it("needs two or more colors of mana", () => {
    expect(producesFixing(["G"])).toBe(false);
    expect(producesFixing(["C", "G"])).toBe(false);
    expect(producesFixing(["G", "U"])).toBe(true);
    expect(producesFixing(["B", "G", "R", "U", "W"])).toBe(true);
  });
});

describe("functionTags", () => {
  const index = { [removal]: ["bolt"], [fetchland]: ["wilds"] };

  it("reads oracle tags by id, as tag ids in function order", () => {
    expect(functionTags({ oracleId: "bolt", producedMana: [] }, index)).toEqual(["removal"]);
    expect(functionTags({ oracleId: "elf", producedMana: ["G"] }, index)).toEqual([]);
  });

  it("counts fetchlands and multicolor mana as fixing, once", () => {
    expect(functionTags({ oracleId: "wilds", producedMana: [] }, index)).toEqual(["fixing"]);
    expect(functionTags({ oracleId: "birds", producedMana: ["W", "U"] }, index)).toEqual([
      "fixing",
    ]);
    expect(functionTags({ oracleId: "wilds", producedMana: ["W", "U"] }, index)).toEqual([
      "fixing",
    ]);
  });
});

describe("withFunctionTags", () => {
  it("adds every missing function as a tag and keeps the designer's tags", () => {
    const mine = { id: "removal", label: "Kill spells" } as const;
    const vocabulary = withFunctionTags([mine]);
    expect(vocabulary[0]).toEqual(mine);
    expect(vocabulary).toHaveLength(FUNCTION_TAGS.length);
  });
});
