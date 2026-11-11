import type { Filter } from "@repo/cube/browser";
import { describe, expect, it } from "vitest";
import type { GridCard } from "../modes/mode.ts";
import {
  balanceRows,
  matchups,
  peekKeys,
  pickKeys,
  project,
  resolvePill,
  stackQuery,
} from "./model.ts";

const filters: Filter[] = [
  { id: "cheap", label: "Cheap", query: "mv<=2 or t:land", view: "cards" },
];

describe("stackQuery", () => {
  it("joins typed queries, saved filters, and chart buckets into one query", () => {
    expect(stackQuery(["x:c=r", "f:cheap", "curve:2", "pt:2:3"], filters)).toBe(
      "c=r (mv<=2 or t:land) mv=2 t:creature pow=2 tou=3",
    );
  });

  it("skips pills it can't resolve", () => {
    expect(stackQuery(["f:gone", "tag:removal"], filters)).toBe("tag:removal");
  });
});

describe("resolvePill", () => {
  it("labels a power by toughness cell", () => {
    expect(resolvePill("pt:2:3", filters)?.label).toBe("2/3");
  });
});

describe("picking chart buckets", () => {
  it("ors buckets from the same chart and ands different charts", () => {
    const one = pickKeys([], "colorCurve:R:2");
    expect(one).toEqual(["colorCurve:R:2"]);
    const two = pickKeys(one, "colorCurve:U:3");
    expect(two).toEqual(["or:colorCurve:R:2|colorCurve:U:3"]);
    expect(pickKeys(two, "curve:1")).toEqual(["or:colorCurve:R:2|colorCurve:U:3", "curve:1"]);
    expect(pickKeys(two, "colorCurve:R:2")).toEqual(["colorCurve:U:3"]);
    expect(pickKeys(["colorCurve:U:3"], "colorCurve:U:3")).toEqual([]);
    expect(pickKeys(["x:c=r"], "x:c=r")).toEqual([]);
  });

  it("previews a pick on hover without undoing one already made", () => {
    expect(peekKeys(["curve:2"], "curve:3")).toEqual(["or:curve:2|curve:3"]);
    expect(peekKeys(["or:curve:2|curve:3"], "curve:3")).toEqual(["or:curve:2|curve:3"]);
    expect(peekKeys(["curve:2"], "f:cheap")).toEqual(["curve:2", "f:cheap"]);
  });

  it("labels, tests, and queries an or pill", () => {
    const pill = resolvePill("or:curve:2|tag:removal", filters);
    expect(pill?.label).toBe("MV 2 or #removal");
    expect(stackQuery(["or:curve:2|curve:3", "x:c=r"], filters)).toBe("((mv=2) or (mv=3)) c=r");
  });
});

describe("project", () => {
  const card = (slug: string, status: "draft" | "prospect") =>
    ({ slug, status }) as unknown as Parameters<typeof project>[0][number];

  it("applies every pending move, the last one winning for a card", () => {
    const cards = [card("a", "draft"), card("b", "prospect"), card("c", "draft")];
    const moved = project(cards, [
      { slug: "a", to: "prospect" },
      { slug: "b", to: "draft" },
      { slug: "a", to: "draft" },
      { slug: "c" },
    ]);
    expect(moved.map((entry) => entry.status)).toEqual(["draft", "draft", "draft"]);
  });
});

function creature(slug: string, mv: number, power: string, toughness: string): GridCard {
  return {
    slug,
    name: slug,
    status: "draft",
    cmc: mv,
    typeLine: "Creature — Test",
    power,
    toughness,
    colors: [],
    colorIdentity: [],
    manaCost: "",
    tags: [],
  } as unknown as GridCard;
}

describe("balanceRows", () => {
  const scope = [
    creature("a", 2, "1", "1"),
    creature("b", 2, "2", "2"),
    creature("c", 2, "2", "3"),
    creature("d", 2, "5", "5"),
  ];
  const arriving = creature("e", 2, "3", "3");

  it("places each body against the scope's middle half and marks moves", () => {
    const [row] = balanceRows(scope, [...scope.slice(1), arriving], undefined);
    expect(row?.tally).toMatchObject({ id: "creatureCurve:2", base: 4, ghost: 0 });
    const by = new Map(row?.dots.map((dot) => [dot.card.slug, dot]));
    expect(by.get("a")).toMatchObject({ place: "below", state: "leaving" });
    expect(by.get("d")).toMatchObject({ place: "above", state: "hit" });
    expect(by.get("e")).toMatchObject({ state: "arriving", size: 6 });
  });

  it("fades bodies outside the lens", () => {
    const [row] = balanceRows(scope, scope, (card) => card.slug === "b");
    expect(row?.tally.hit).toBe(1);
    expect(row?.dots.filter((dot) => dot.state === "faint")).toHaveLength(3);
  });
});

describe("matchups", () => {
  const scope = [
    creature("bear", 2, "2", "2"),
    creature("wall", 2, "0", "6"),
    creature("giant", 6, "6", "6"),
    creature("elf", 1, "1", "1"),
  ];

  it("scores each body against the scope and sorts it into a corner", () => {
    const { dots, corners } = matchups(scope, scope, undefined);
    const by = new Map(dots.map((dot) => [dot.tally.id, dot]));
    expect(by.get("body:6:6")).toMatchObject({ kills: 1, survives: 0.75, corner: "wins" });
    expect(by.get("body:0:6")).toMatchObject({ kills: 0, survives: 0.75, corner: "wall" });
    expect(by.get("body:1:1")).toMatchObject({ corner: "chump" });
    expect(corners.find((corner) => corner.corner === "wins")?.base).toBe(2);
  });

  it("counts an arriving body as a ghost without moving the others", () => {
    const before = matchups(scope, scope, undefined);
    const after = matchups(scope, [...scope, creature("ogre", 3, "3", "3")], undefined);
    const ogre = after.dots.find((dot) => dot.tally.id === "body:3:3");
    expect(ogre).toMatchObject({ arriving: true, tally: { base: 0, ghost: 1 } });
    expect(after.dots.find((dot) => dot.tally.id === "body:2:2")?.kills).toBe(
      before.dots.find((dot) => dot.tally.id === "body:2:2")?.kills,
    );
  });
});
