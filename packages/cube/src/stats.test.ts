import { describe, expect, it } from "vitest";
import type { StatCard } from "./stats.ts";
import { cubeStats, isLand } from "./stats.ts";

function card(overrides: Partial<StatCard>): StatCard {
  return { status: "draft", colors: [], cmc: 0, typeLine: "Instant", tags: [], ...overrides };
}

const cards: StatCard[] = [
  card({ colors: ["R"], cmc: 1, tags: ["burn"] }),
  card({ colors: ["R"], cmc: 1, status: "prospect" }),
  card({ colors: ["U", "R"], cmc: 2, tags: ["burn"] }),
  card({ cmc: 9, typeLine: "Artifact Creature — Eldrazi", status: "cut" }),
  card({ typeLine: "Land" }),
  card({ colors: ["G"], cmc: 3, typeLine: "Creature — Elf // Land" }),
  card({ colors: ["G"], cmc: 0, typeLine: "Instant // Land" }),
];

describe("cubeStats", () => {
  const stats = cubeStats(cards, [{ id: "burn", label: "Burn", kind: "group" }]);

  it("counts every card once by status, and every nonland card once by color", () => {
    expect(stats.total).toBe(7);
    expect(stats.status.map((row) => row.count)).toEqual([5, 1, 1]);
    const colors = Object.fromEntries(stats.colors.map((row) => [row.id, row.count]));
    expect(colors).toEqual({ W: 0, U: 0, B: 0, R: 2, G: 2, multicolored: 1, colorless: 1 });
    expect(stats.colors.reduce((sum, row) => sum + row.count, 0)).toBe(stats.total - stats.lands);
  });

  it("builds the curve from nonland cards and caps it at 7+", () => {
    expect(stats.lands).toBe(1);
    expect(stats.curve.map((row) => [row.label, row.count])).toEqual([
      ["0", 1],
      ["1", 2],
      ["2", 1],
      ["3", 1],
      ["4", 0],
      ["5", 0],
      ["6", 0],
      ["7+", 1],
    ]);
  });

  it("counts tags from the vocabulary", () => {
    expect(stats.tags).toEqual([{ id: "burn", label: "Burn", kind: "group", count: 2 }]);
  });
});

describe("isLand", () => {
  it("reads only the front face", () => {
    expect(isLand({ typeLine: "Legendary Land" })).toBe(true);
    expect(isLand({ typeLine: "Instant // Land" })).toBe(false);
    expect(isLand({ typeLine: "Land Creature — Forest Dryad" })).toBe(true);
    expect(isLand({ typeLine: "Creature — Landfall Elemental" })).toBe(false);
  });
});
