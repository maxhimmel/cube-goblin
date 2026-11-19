import type { GroupRow } from "@repo/cube/browser";
import { describe, expect, it } from "vitest";
import { byGap, defaultPins, gapCount, gapLabel, radarIds } from "./model.ts";

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

  it("orders pins by gap size whatever order they were pinned in", () => {
    expect(byGap(["b", "e", "a", "d"], rowOf)).toEqual(["a", "d", "e", "b"]);
    expect(byGap(["d", "a", "b", "e"], rowOf)).toEqual(["a", "d", "e", "b"]);
    expect(byGap(["c", "b"], rowOf)).toEqual(["b", "c"]);
  });

  it("labels a gap with its sign", () => {
    expect(gapLabel(-0.07)).toBe("−7");
    expect(gapLabel(0.21)).toBe("+21");
  });
});
