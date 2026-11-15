import { describe, expect, it } from "vitest";
import { parseList } from "./index.ts";
import type { Identifier, ResolvableCard } from "./resolve.ts";
import { resolveRows } from "./resolve.ts";

interface FakeCard extends ResolvableCard {
  oracle: string;
}

const CARDS: FakeCard[] = [
  {
    id: "p-abrade",
    oracle: "abrade",
    name: "Abrade",
    set: "soa",
    collector_number: "37",
    mtgo_id: 1,
  },
  {
    id: "p-fire",
    oracle: "fire",
    name: "Fire // Ice",
    set: "mh2",
    collector_number: "290",
    card_faces: [{ name: "Fire" }, { name: "Ice" }],
  },
  {
    id: "p-grave",
    oracle: "grave",
    name: "Grave Researcher // Reanimate",
    set: "eoc",
    collector_number: "12",
    card_faces: [{ name: "Grave Researcher" }, { name: "Reanimate" }],
  },
  { id: "p-cabal", oracle: "cabal", name: "Cabal Pit", set: "plst", collector_number: "ODY-315" },
];

function fakeResolver(calls: Identifier[][]) {
  return {
    collection: (identifiers: readonly Identifier[]) => {
      calls.push([...identifiers]);
      const cards = identifiers.flatMap((identifier) =>
        CARDS.filter((card) => {
          if ("id" in identifier) return card.id === identifier.id;
          if ("mtgo_id" in identifier) return card.mtgo_id === identifier.mtgo_id;
          if ("collector_number" in identifier)
            return (
              card.set === identifier.set && card.collector_number === identifier.collector_number
            );
          return card.name === identifier.name;
        }),
      );
      return Promise.resolve({ cards });
    },
    fuzzy: (name: string) =>
      Promise.resolve(CARDS.find((card) => card.name.startsWith(name.slice(0, 5)))),
  };
}

describe("resolveRows", () => {
  it("tries printing id, MTGO id, set and number, then name, then fuzzy", async () => {
    const calls: Identifier[][] = [];
    const rows = [
      { name: "Whatever", printingId: "p-abrade" },
      { name: "Fire/Ice", mtgoId: 99 },
      { name: "Cabal Pit", set: "plst", collectorNumber: "ODY-315" },
      { name: "Grave Researcher / Reanimate", set: "dar", collectorNumber: "1" },
      { name: "Abradee" },
      { name: "Nothing Like It" },
    ];
    const { matches, misses } = await resolveRows(rows, fakeResolver(calls));
    expect(matches.map((match) => [match.row.name, match.card.id, match.how])).toEqual([
      ["Whatever", "p-abrade", "printing"],
      ["Fire/Ice", "p-fire", "name"],
      ["Cabal Pit", "p-cabal", "set-number"],
      ["Grave Researcher / Reanimate", "p-grave", "name"],
      ["Abradee", "p-abrade", "fuzzy"],
    ]);
    expect(misses.map((miss) => miss.row.name)).toEqual(["Nothing Like It"]);
    expect(calls.map((call) => Object.keys(call[0] ?? {}).join("+"))).toEqual([
      "id",
      "mtgo_id",
      "set+collector_number",
      "name",
    ]);
  });

  it("asks for each name once", async () => {
    const calls: Identifier[][] = [];
    const { rows } = parseList("Abrade\nAbrade\nabrade\n");
    await resolveRows(rows, fakeResolver(calls));
    expect(calls).toEqual([[{ name: "Abrade" }]]);
  });
});
