import { describe, expect, it } from "vitest";
import {
  cardOverlap,
  groupAverage,
  inCompareScope,
  matchTags,
  scaled,
  statTest,
  translateTags,
  unmatchedTagCounts,
} from "./compare.ts";
import type { CardStatus } from "./schema.ts";

function card(
  name: string,
  typeLine: string,
  cmc: number,
  colors: string[],
  tags: string[] = [],
  status: CardStatus = "draft",
) {
  return {
    name,
    oracleId: `id-${name}`,
    status,
    typeLine,
    cmc,
    colors,
    manaCost: "",
    tags,
  };
}

const mine = [
  card("Shock", "Instant", 1, ["R"], ["removal"]),
  card("Bear", "Creature — Bear", 2, ["G"]),
  card("Forest", "Basic Land — Forest", 0, []),
  card("Ponder", "Sorcery", 1, ["U"], ["cantrip"], "prospect"),
];

const theirs = [
  card("Shock", "Instant", 1, ["R"], ["burn"]),
  card("Bolt", "Instant", 1, ["R"], ["burn", "kill"]),
  card("Murder", "Instant", 3, ["B"], ["kill"]),
  card("Opt", "Instant", 1, ["U"], ["cantrips"], "cut"),
];

describe("matchTags", () => {
  it("matches by label or id, ignoring case, spaces, and dashes", () => {
    const match = matchTags(
      [
        { id: "removal", label: "Removal" },
        { id: "card-draw", label: "Card draw" },
      ],
      [
        { id: "kill", label: "REMOVAL" },
        { id: "draw", label: "card_draw" },
        { id: "burn", label: "Burn" },
      ],
    );
    expect([...match.ids]).toEqual([
      ["kill", "removal"],
      ["draw", "card-draw"],
    ]);
    expect(match.unmatched.map((tag) => tag.id)).toEqual(["burn"]);
  });

  it("translates matched tags and marks the rest so they can't collide", () => {
    const match = matchTags(
      [{ id: "removal", label: "Removal" }],
      [{ id: "kill", label: "Removal" }],
    );
    const translated = translateTags(theirs, match);
    expect(translated.map((entry) => entry.tags)).toEqual([
      ["~burn"],
      ["~burn", "removal"],
      ["removal"],
      ["~cantrips"],
    ]);
    expect(
      unmatchedTagCounts(translated, {
        ...match,
        unmatched: [
          { id: "burn", label: "Burn" },
          { id: "cantrips", label: "Cantrips" },
          { id: "unused", label: "Unused" },
        ],
      }),
    ).toEqual([
      { tag: { id: "burn", label: "Burn" }, count: 2 },
      { tag: { id: "cantrips", label: "Cantrips" }, count: 1 },
    ]);
  });
});

describe("cardOverlap", () => {
  it("splits cards into shared and only-one-side by oracle id, sorted by name", () => {
    const overlap = cardOverlap(mine, theirs);
    expect(overlap.shared.map((entry) => entry.name)).toEqual(["Shock"]);
    expect(overlap.onlyHere.map((entry) => entry.name)).toEqual(["Bear", "Forest", "Ponder"]);
    expect(overlap.onlyThere.map((entry) => entry.name)).toEqual(["Bolt", "Murder", "Opt"]);
  });
});

describe("scope and scale", () => {
  it("keeps draft only, or every card", () => {
    expect(theirs.filter((entry) => inCompareScope(entry, "draft"))).toHaveLength(3);
    expect(theirs.filter((entry) => inCompareScope(entry, "all"))).toHaveLength(4);
  });

  it("scales another cube's count to this cube's size", () => {
    expect(scaled(15, 540, 360)).toBe(10);
    expect(scaled(3, 0, 360)).toBe(0);
  });

  it("tests summary rows and buckets", () => {
    expect(mine.filter(statTest("cards") ?? (() => false))).toHaveLength(4);
    expect(mine.filter(statTest("nonland") ?? (() => false))).toHaveLength(3);
    expect(mine.filter(statTest("curve:1") ?? (() => false))).toHaveLength(2);
    expect(statTest("nonsense")).toBeUndefined();
  });
});

describe("groupAverage", () => {
  it("gives each cube's share of a row and its distance from the mean share", () => {
    const [red] = groupAverage([mine, theirs.slice(0, 2)], ["color:R"]);
    expect(red?.mean).toBeCloseTo(0.625);
    expect(red?.cells.map((cell) => cell.count)).toEqual([1, 2]);
    expect(red?.cells.map((cell) => cell.delta)).toEqual([-0.375, 0.375]);
  });

  it("skips unknown rows and handles an empty cube", () => {
    expect(groupAverage([[], mine], ["nope", "cards"]).map((row) => row.id)).toEqual(["cards"]);
    expect(groupAverage([[]], ["cards"])[0]?.cells[0]?.share).toBe(0);
  });
});
