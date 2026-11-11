import { describe, expect, it } from "vitest";
import type { GridCard } from "../modes/mode.ts";
import { tryQuery } from "./query.ts";

function card(overrides: Partial<GridCard>): GridCard {
  return {
    slug: "x",
    name: "Test Card",
    oracleId: "x",
    status: "draft",
    manaCost: "{1}{R}",
    typeLine: "Creature — Goblin",
    oracleText: "Haste. When this enters, draw a card.",
    cmc: 2,
    colors: ["R"],
    power: "3",
    toughness: "2",
    tags: ["burn"],
    image: "",
    imageLarge: "",
    scryfallUri: "",
    ...overrides,
  };
}

function matches(query: string, target: GridCard): boolean {
  const { test, error } = tryQuery(query);
  if (!test) {
    throw new Error(error);
  }
  return test(target);
}

describe("tryQuery", () => {
  const goblin = card({});
  const wall = card({ name: "Wall", colors: ["W"], power: "0", toughness: "4", tags: [] });

  it("compares numbers and fields", () => {
    expect(matches("pow>=3", goblin)).toBe(true);
    expect(matches("pow>=3", wall)).toBe(false);
    expect(matches("tou>pow", wall)).toBe(true);
    expect(matches("mv=2", goblin)).toBe(true);
  });

  it("handles colors, types, text, tags, status", () => {
    expect(matches("c:r t:creature", goblin)).toBe(true);
    expect(matches("c:m", goblin)).toBe(false);
    expect(matches('o:"draw a card"', goblin)).toBe(true);
    expect(matches("tag:burn is:draft", goblin)).toBe(true);
  });

  it("negates, ors, and groups", () => {
    expect(matches("-c:r", wall)).toBe(true);
    expect(matches("c:u or c:w", wall)).toBe(true);
    expect(matches("(c:u or c:w) pow>=1", wall)).toBe(false);
  });

  it("reports errors", () => {
    expect(tryQuery("foo:bar").error).toMatch(/Unknown keyword/u);
    expect(tryQuery("(pow>1").error).toMatch(/Missing \)/u);
    expect(tryQuery("pow>x").error).toMatch(/number/u);
  });
});
