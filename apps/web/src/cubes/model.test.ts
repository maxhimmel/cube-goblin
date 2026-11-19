import type { GroupRow } from "@repo/cube/browser";
import { describe, expect, it } from "vitest";
import type { Column } from "./model.ts";
import { biggestGap, defaultPins, gapCount, gapLabel, radarIds, tells } from "./model.ts";
import type { StatRow } from "./rows.tsx";

function row(id: string, shares: number[]): GroupRow {
  const mean = shares.reduce((sum, share) => sum + share, 0) / shares.length;
  return {
    id,
    mean,
    cells: shares.map((share) => ({ count: Math.round(share * 10), share, delta: share - mean })),
  };
}

const rows = [
  row("a", [0.5, 0.1]),
  row("b", [0.2, 0.2]),
  row("c", [0, 0]),
  row("d", [0.1, 0.3]),
  row("e", [0.3, 0.32]),
];
const rowOf = new Map(rows.map((entry) => [entry.id, entry]));
const columns = [{ cube: { name: "One" } }, { cube: { name: "Two" } }] as unknown as Column[];
const specs = new Map<string, StatRow>(
  rows.map((entry) => [
    entry.id,
    { id: entry.id, label: entry.id, noun: `${entry.id}s`, section: "S" },
  ]),
);

describe("cubes model", () => {
  it("drops empty spokes and keeps the widest gaps when a section has too many", () => {
    expect(radarIds(["a", "b", "c", "d"], rowOf)).toEqual(["a", "b", "d"]);
    const many = Array.from({ length: 10 }, (_, index) =>
      row(`r${String(index)}`, [index / 20, 0]),
    );
    const manyOf = new Map(many.map((entry) => [entry.id, entry]));
    expect(radarIds([...manyOf.keys()], manyOf)).toEqual([
      "r2",
      "r3",
      "r4",
      "r5",
      "r6",
      "r7",
      "r8",
      "r9",
    ]);
  });

  it("pins the widest gaps by default and counts gaps of five points or more", () => {
    expect(defaultPins(rowOf)).toEqual(["a", "d", "e", "b"]);
    expect(gapCount(rows)).toBe(2);
  });

  it("names each cube's top tells and the single biggest gap", () => {
    expect(tells(columns, rowOf, specs)).toEqual([
      { cube: 0, nouns: ["as"] },
      { cube: 1, nouns: ["ds"] },
    ]);
    expect(biggestGap(rowOf)).toMatchObject({ cube: 0, id: "a", delta: 0.2 });
    expect(gapLabel(-0.07)).toBe("−7");
  });
});
