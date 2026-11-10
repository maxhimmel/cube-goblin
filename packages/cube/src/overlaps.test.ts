import { describe, expect, it } from "vitest";
import { matchesTags, overlapFilter, parseTagList, tagOverlaps } from "./overlaps.ts";

const cards = [
  { name: "Shock", tags: ["removal", "burn"] },
  { name: "Bolt", tags: ["removal", "burn", "tempo"] },
  { name: "Doom Blade", tags: ["removal"] },
  { name: "Ponder", tags: ["cantrip"] },
  { name: "Lava Spike", tags: ["burn"] },
  { name: "Forest", tags: [] },
];

function summary(picked: string[]): [string[], string[]][] {
  return tagOverlaps(cards, picked).map((overlap) => [
    overlap.tags,
    overlap.cards.map((card) => card.name),
  ]);
}

describe("tagOverlaps", () => {
  it("puts every card in exactly one overlap of the picked tags", () => {
    const overlaps = tagOverlaps(cards, ["removal", "burn", "tempo"]);
    expect(overlaps.flatMap((overlap) => overlap.cards)).toHaveLength(cards.length);
  });

  it("sorts by count, then size, then picked order, and puts no-tag cards last", () => {
    expect(summary(["burn", "removal"])).toEqual([
      [
        ["burn", "removal"],
        ["Shock", "Bolt"],
      ],
      [["burn"], ["Lava Spike"]],
      [["removal"], ["Doom Blade"]],
      [[], ["Ponder", "Forest"]],
    ]);
  });

  it("leaves out overlaps with no cards", () => {
    expect(summary(["cantrip", "tempo"]).map(([tags]) => tags)).toEqual([
      ["cantrip"],
      ["tempo"],
      [],
    ]);
  });
});

describe("overlapFilter and matchesTags", () => {
  it("matches exactly the cards in the overlap", () => {
    const picked = ["removal", "burn", "tempo"];
    for (const overlap of tagOverlaps(cards, picked)) {
      const filter = overlapFilter(picked, overlap.tags);
      expect(cards.filter((card) => matchesTags(card, filter))).toEqual(overlap.cards);
    }
  });
});

describe("parseTagList", () => {
  it("splits on commas and drops blanks and repeats", () => {
    expect(parseTagList("a,,b,a")).toEqual(["a", "b"]);
    expect(parseTagList(undefined)).toEqual([]);
  });
});
