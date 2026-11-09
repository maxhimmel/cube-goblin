import { describe, expect, it } from "vitest";
import { CARD_FUNCTIONS, cardFunctions, producesFixing } from "./functions.ts";

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

describe("cardFunctions", () => {
  const index = { [removal]: ["bolt"], [fetchland]: ["wilds"] };

  it("reads oracle tags by id, in function order", () => {
    expect(cardFunctions({ oracleId: "bolt", producedMana: [] }, index)).toEqual(["removal"]);
    expect(cardFunctions({ oracleId: "elf", producedMana: ["G"] }, index)).toEqual([]);
  });

  it("counts fetchlands and multicolor mana as fixing, once", () => {
    expect(cardFunctions({ oracleId: "wilds", producedMana: [] }, index)).toEqual(["fixing"]);
    expect(cardFunctions({ oracleId: "birds", producedMana: ["W", "U"] }, index)).toEqual([
      "fixing",
    ]);
    expect(cardFunctions({ oracleId: "wilds", producedMana: ["W", "U"] }, index)).toEqual([
      "fixing",
    ]);
  });
});
