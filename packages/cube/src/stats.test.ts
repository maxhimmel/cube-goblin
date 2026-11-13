import { describe, expect, it } from "vitest";
import type { StatCard } from "./stats.ts";
import type { BucketKind, Count } from "./stats.ts";
import { bucketId, cubeStats, inBucket, isLand, parseBucket, pipColors } from "./stats.ts";

function card(overrides: Partial<StatCard>): StatCard {
  return { status: "draft", colors: [], cmc: 0, typeLine: "Instant", tags: [], ...overrides };
}

const cards: StatCard[] = [
  card({ colors: ["R"], cmc: 1, tags: ["burn"], manaCost: "{R}" }),
  card({ colors: ["R"], cmc: 1, status: "prospect" }),
  card({ colors: ["U", "R"], cmc: 2, tags: ["burn"], manaCost: "{U/R}{R}" }),
  card({ cmc: 9, typeLine: "Artifact Creature — Eldrazi", status: "cut" }),
  card({ typeLine: "Land" }),
  card({ colors: ["G"], cmc: 3, typeLine: "Creature — Elf // Land" }),
  card({ colors: ["G"], cmc: 0, typeLine: "Instant // Land" }),
];

describe("cubeStats", () => {
  const stats = cubeStats(cards, [{ id: "burn", label: "Burn" }]);

  it("counts every card type a card has, read from the front face", () => {
    const types = Object.fromEntries(stats.types.map((row) => [row.id, row.count]));
    expect(types).toEqual({
      creature: 2,
      planeswalker: 0,
      instant: 4,
      sorcery: 0,
      artifact: 1,
      enchantment: 0,
      battle: 0,
      other: 0,
      land: 1,
    });
    expect(stats.creatures).toBe(2);
  });

  it("counts a multicolored card for each of its colors and as multicolored", () => {
    const presence = Object.fromEntries(stats.presence.map((row) => [row.id, row.count]));
    expect(presence).toEqual({ W: 0, U: 1, B: 0, R: 3, G: 2, multicolored: 1 });
  });

  it("counts cards with two or more pips of a color, per face", () => {
    const heavy = cubeStats(
      [
        card({ colors: ["U", "R"], manaCost: "{U/R}{R}" }),
        card({ colors: ["R"], manaCost: "{R}" }),
        card({ colors: ["W"], manaCost: "{W} // {2}{W}{W}" }),
        card({ colors: ["W"], manaCost: "{W} // {W}" }),
        card({ typeLine: "Land", manaCost: "{R}{R}" }),
      ],
      [],
    ).heavy;
    expect(Object.fromEntries(heavy.map((row) => [row.id, row.count]))).toEqual({
      W: 1,
      U: 0,
      B: 0,
      R: 1,
      G: 0,
    });
  });

  it("splits nonland cards by color and mana value, matching both totals", () => {
    const cell = (row: string, column: string) =>
      stats.colorCurve.find((entry) => entry.row === row && entry.column === column)?.count;
    expect(cell("R", "1")).toBe(2);
    expect(cell("multicolored", "2")).toBe(1);
    expect(cell("colorless", "7")).toBe(1);
    expect(stats.colorCurve.reduce((sum, entry) => sum + entry.count, 0)).toBe(
      stats.total - stats.lands,
    );
  });

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
    expect(stats.tags).toEqual([{ id: "burn", label: "Burn", count: 2 }]);
  });
});

describe("power and toughness", () => {
  const creatures = [
    card({ typeLine: "Creature — Elf", power: "1", toughness: "1" }),
    card({ typeLine: "Artifact Creature — Golem", power: "3", toughness: "3" }),
    card({ typeLine: "Creature — Eldrazi", power: "10", toughness: "*" }),
    card({ typeLine: "Creature — Spirit", power: "1+*", toughness: "2" }),
    card({ typeLine: "Artifact — Vehicle", power: "3", toughness: "3" }),
    card({ typeLine: "Instant" }),
  ];
  const cells = cubeStats(creatures, []).powerToughness;
  const cell = (row: string, column: string) =>
    cells.find((entry) => entry.row === row && entry.column === column)?.count;

  it("counts creatures by power and toughness, capping at 6+ and folding variable values into *", () => {
    expect(cell("1", "1")).toBe(1);
    expect(cell("3", "3")).toBe(1);
    expect(cell("6", "*")).toBe(1);
    expect(cell("*", "2")).toBe(1);
    expect(cells.reduce((sum, entry) => sum + entry.count, 0)).toBe(4);
  });

  it("lists exactly the creatures in a cell", () => {
    for (const entry of cells) {
      const bucket = parseBucket(bucketId("pt", entry.row, entry.column));
      expect(creatures.filter((c) => bucket && inBucket(c, bucket)).length).toBe(entry.count);
    }
  });
});

describe("pipColors", () => {
  it("counts hybrid halves and phyrexian symbols, not generic or colorless", () => {
    expect(pipColors("{2}{W}{W}")).toEqual(["W", "W"]);
    expect(pipColors("{W/U}{B/P}{2/R}{C}{X}")).toEqual(["W", "U", "B", "R"]);
    expect(pipColors("")).toEqual([]);
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

describe("inBucket", () => {
  const vocabulary = [{ id: "burn", label: "Burn" }];
  const stats = cubeStats(cards, vocabulary);
  const counted: [BucketKind, Count[]][] = [
    ["curve", stats.curve],
    ["color", stats.colors],
    ["presence", stats.presence],
    ["heavy", stats.heavy],
    ["type", stats.types],
    ["status", stats.status],
    ["tag", stats.tags],
  ];

  it("lists exactly the cards each bar counts", () => {
    for (const [kind, rows] of counted) {
      for (const row of rows) {
        const bucket = parseBucket(bucketId(kind, row.id));
        expect(bucket, `${kind}:${row.id}`).toBeDefined();
        const listed = cards.filter((card) => bucket && inBucket(card, bucket));
        expect(listed.length, `${kind}:${row.id}`).toBe(row.count);
      }
    }
    for (const cell of stats.colorCurve) {
      const bucket = parseBucket(bucketId("colorCurve", cell.row, cell.column));
      expect(cards.filter((card) => bucket && inBucket(card, bucket)).length).toBe(cell.count);
    }
  });

  it("splits a color's presence into mono cards and multicolored cards with it", () => {
    for (const color of ["W", "U", "B", "R", "G"]) {
      const listed = (id: string) => {
        const bucket = parseBucket(id);
        return cards.filter((c) => bucket && inBucket(c, bucket)).length;
      };
      expect(listed(bucketId("color", color)) + listed(bucketId("colorMulti", color))).toBe(
        listed(bucketId("presence", color)),
      );
    }
    expect(cards.filter((c) => inBucket(c, { kind: "colorMulti", keys: ["U"] })).length).toBe(1);
  });

  it("rejects unknown buckets", () => {
    expect(parseBucket("nope:1")).toBeUndefined();
    expect(parseBucket("curve")).toBeUndefined();
  });
});
