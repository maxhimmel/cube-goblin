import { describe, expect, it } from "vitest";
import type { FilterChip } from "./filters.ts";
import {
  cycleChip,
  filterCards,
  matchesFilter,
  newFilterId,
  pruneFilters,
  validateFilters,
} from "./filters.ts";
import type { StatCard } from "./stats.ts";

function card(overrides: Partial<StatCard>): StatCard {
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

function matching(chips: FilterChip[]): StatCard[] {
  return cards.filter((entry) => matchesFilter(entry, chips));
}

describe("filters", () => {
  it("matches everything with no chips", () => {
    expect(matching([])).toEqual(cards);
  });

  it("ors chips of one kind and ands kinds", () => {
    expect(matching([{ bucket: "curve:1" }, { bucket: "curve:2" }])).toEqual([bolt, bear, helix]);
    expect(matching([{ bucket: "curve:2" }, { bucket: "tag:removal" }])).toEqual([helix]);
  });

  it("needs every tag, like the Wall's with", () => {
    expect(matching([{ bucket: "tag:removal" }, { bucket: "tag:burn" }])).toEqual([bolt]);
  });

  it("drops cards that match an excluded chip", () => {
    expect(matching([{ bucket: "tag:removal" }, { bucket: "type:land", not: true }])).toEqual([
      bolt,
      helix,
    ]);
  });

  it("matches chart buckets the same way the charts count them", () => {
    expect(matching([{ bucket: "body:2:2" }])).toEqual([bear]);
    expect(matching([{ bucket: "presence:W" }])).toEqual([helix]);
  });

  it("uses the page scope unless the filter names a status", () => {
    const scoped = cards.filter((entry) => entry.status === "draft");
    expect(filterCards({ chips: [{ bucket: "tag:removal" }] }, cards, scoped)).toEqual([
      bolt,
      land,
    ]);
    expect(filterCards({ chips: [{ bucket: "status:prospect" }] }, cards, scoped)).toEqual([helix]);
  });

  it("cycles a chip from off to with to without and back", () => {
    const once = cycleChip([], "color:R");
    expect(once).toEqual([{ bucket: "color:R" }]);
    const twice = cycleChip(once, "color:R");
    expect(twice).toEqual([{ bucket: "color:R", not: true }]);
    expect(cycleChip(twice, "color:R")).toEqual([]);
  });

  it("prunes and reports tags that left the vocabulary", () => {
    const file = {
      filters: [
        {
          id: "a",
          label: "A",
          chips: [{ bucket: "tag:gone" }, { bucket: "curve:1" }],
          view: "cards",
        },
        { id: "a", label: "B", chips: [], view: "cards" },
      ],
    };
    expect(validateFilters(file, [])).toHaveLength(2);
    expect(pruneFilters(file, []).filters[0]?.chips).toEqual([{ bucket: "curve:1" }]);
  });

  it("picks a fresh id", () => {
    expect(newFilterId([{ id: "filter-2" }, { id: "x" }])).toBe("filter-3");
    expect(newFilterId([{ id: "filter-1" }])).toBe("filter-2");
  });
});
