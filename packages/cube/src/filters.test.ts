import { describe, expect, it } from "vitest";
import {
  chipsToQuery,
  filterCards,
  filterTest,
  filtersFileSchema,
  narrowTo,
  newFilterId,
  pruneFilters,
  validateFilters,
} from "./filters.ts";
import type { QueryCard } from "./query.ts";

function card(overrides: Partial<QueryCard>): QueryCard {
  return { status: "draft", colors: [], cmc: 0, typeLine: "Instant", tags: [], ...overrides };
}

const bolt = card({ colors: ["R"], cmc: 1, tags: ["removal", "burn"] });
const bear = card({
  colors: ["G"],
  cmc: 2,
  typeLine: "Creature — Bear",
  power: "2",
  toughness: "2",
});
const helix = card({ colors: ["R", "W"], cmc: 2, tags: ["removal"], status: "prospect" });
const land = card({ typeLine: "Land", tags: ["removal"] });
const cards = [bolt, bear, helix, land];

function matching(query: string): QueryCard[] {
  return cards.filter(filterTest({ query }));
}

describe("filters", () => {
  it("matches everything with an empty query", () => {
    expect(matching("")).toEqual(cards);
  });

  it("uses the page scope unless the query names a status", () => {
    const scoped = cards.filter((entry) => entry.status === "draft");
    expect(filterCards({ query: "tag:removal" }, cards, scoped)).toEqual([bolt, land]);
    expect(filterCards({ query: "is:prospect" }, cards, scoped)).toEqual([helix]);
  });

  it("turns old chip filters into the same query", () => {
    const chips = [
      { bucket: "curve:1" },
      { bucket: "curve:2" },
      { bucket: "tag:removal" },
      { bucket: "type:land", not: true },
    ];
    const query = chipsToQuery(chips);
    expect(query).toBe("(mv=1 or mv=2) tag:removal -t:land");
    expect(matching(query)).toEqual([bolt, helix]);
    expect(chipsToQuery([{ bucket: "color:W", not: true }])).toBe("-(is:spell c=w)");
    expect(chipsToQuery([{ bucket: "tag:a" }, { bucket: "tag:b" }])).toBe("tag:a tag:b");
  });

  it("upgrades chips when reading the file", () => {
    const file = filtersFileSchema.parse({
      filters: [{ id: "a", label: "A", chips: [{ bucket: "tag:burn" }], view: "color" }],
    });
    expect(file.filters[0]).toEqual({ id: "a", label: "A", query: "tag:burn", view: "color" });
  });

  it("rejects a query that doesn't parse", () => {
    expect(
      filtersFileSchema.safeParse({ filters: [{ id: "a", label: "A", query: "pow>" }] }).success,
    ).toBe(false);
  });

  it("prunes and reports tags that left the vocabulary", () => {
    const file = {
      filters: [
        { id: "a", label: "A", query: "tag:gone mv=1", view: "cards" },
        { id: "a", label: "B", query: "", view: "cards" },
      ],
    };
    expect(validateFilters(file, [])).toHaveLength(2);
    expect(pruneFilters(file, []).filters[0]?.query).toBe("mv=1");
    expect(
      pruneFilters(
        { filters: [{ id: "b", label: "B", query: "a  tag:x  tag:y", view: "cards" }] },
        [],
      ).filters[0]?.query,
    ).toBe("a");
  });

  it("never reuses an id", () => {
    const rolls = ["a", "a", "b"];
    expect(newFilterId([{ id: "filter-a" }], () => rolls.shift() ?? "z")).toBe("filter-b");
  });

  it("narrows a query to a chart bucket", () => {
    const query = narrowTo("(is:spell c=w or is:spell c=u) tag:removal", {
      kind: "color",
      keys: ["W"],
    });
    expect(query).toBe("(is:spell c=w or is:spell c=u) tag:removal is:spell c=w");
  });
});
