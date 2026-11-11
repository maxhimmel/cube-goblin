import { describe, expect, it } from "vitest";
import { formatSortKeys, parseSortKeys, sortCards } from "./sort.ts";

const card = (name: string, cmc: number, colors: string[], typeLine: string) => ({
  name,
  cmc,
  colors,
  typeLine,
});

const shock = card("Shock", 1, ["R"], "Instant");
const opt = card("Opt", 1, ["U"], "Instant");
const wurm = card("Craterclaw Colossus", 6, ["G"], "Creature — Wurm");
const charm = card("Prismari Charm", 2, ["U", "R"], "Instant");
const glass = card("Magnifying Glass", 3, [], "Artifact");
const rite = card("Rite of Flame", 1, ["R"], "Sorcery");
const golem = card("Steel Golem", 3, [], "Artifact Creature — Golem");
const cards = [shock, opt, wurm, charm, glass];

describe("sortCards", () => {
  it("keeps the added order when nothing or Added comes first", () => {
    expect(sortCards(cards, [])).toEqual(cards);
    expect(sortCards(cards, ["added", "name"])).toEqual(cards);
  });

  it("sorts by name", () => {
    expect(sortCards(cards, ["name"]).map((c) => c.name)).toEqual([
      "Craterclaw Colossus",
      "Magnifying Glass",
      "Opt",
      "Prismari Charm",
      "Shock",
    ]);
  });

  it("sorts by color in WUBRG order, multicolored, then colorless", () => {
    expect(sortCards(cards, ["color"])).toEqual([opt, shock, wurm, charm, glass]);
  });

  it("combines keys and breaks remaining ties by name", () => {
    expect(sortCards(cards, ["mv", "color"])).toEqual([opt, shock, charm, glass, wurm]);
    expect(sortCards(cards, ["type", "mv"])).toEqual([wurm, opt, shock, charm, glass]);
  });

  it("sorts instants before sorceries, and an artifact creature with creatures", () => {
    expect(sortCards([glass, rite, golem, shock], ["type"])).toEqual([golem, shock, rite, glass]);
  });

  it("sorts by power and toughness, with non-creatures and * last", () => {
    const bear = { ...card("Bear", 2, ["G"], "Creature — Bear"), power: "2", toughness: "2" };
    const wall = { ...card("Wall", 2, ["W"], "Creature — Wall"), power: "0", toughness: "4" };
    const goyf = { ...card("Goyf", 2, ["G"], "Creature — Lhurgoyf"), power: "*", toughness: "1" };
    expect(sortCards([shock, goyf, bear, wall], ["power"])).toEqual([wall, bear, goyf, shock]);
    expect(sortCards([shock, goyf, bear, wall], ["toughness", "name"])).toEqual([
      goyf,
      bear,
      wall,
      shock,
    ]);
  });

  it("takes any number of keys", () => {
    const a = card("A", 2, ["R"], "Instant");
    const b = card("B", 2, ["R"], "Sorcery");
    const c = card("C", 2, ["U"], "Sorcery");
    expect(sortCards([c, b, a], ["mv", "type", "color"])).toEqual([a, c, b]);
  });
});

describe("sort keys in the URL", () => {
  it("parses any number of keys, dropping unknown and repeated ones", () => {
    expect(parseSortKeys("mv.color.power.mv.zz.toughness")).toEqual([
      "mv",
      "color",
      "power",
      "toughness",
    ]);
    expect(parseSortKeys("added.mv")).toEqual(["added"]);
    expect(parseSortKeys("mv.added.name")).toEqual(["mv", "name"]);
    expect(parseSortKeys(undefined)).toEqual([]);
  });

  it("formats keys back, leaving the default out", () => {
    expect(formatSortKeys(["mv", "color", "power"])).toBe("mv.color.power");
    expect(formatSortKeys(["added", "mv"])).toBeUndefined();
    expect(formatSortKeys([])).toBeUndefined();
  });
});
