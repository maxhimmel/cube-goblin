import { describe, expect, it } from "vitest";
import type { ColumnAxis } from "./columns.ts";
import { columnsBy } from "./columns.ts";
import type { StatCard } from "./stats.ts";
import { cubeStats } from "./stats.ts";

type Card = StatCard & { name: string };

function card(name: string, overrides: Partial<Card>): Card {
  return { name, status: "draft", colors: [], cmc: 0, typeLine: "Instant", ...overrides };
}

const cards: Card[] = [
  card("Shock", { colors: ["R"], cmc: 1 }),
  card("Abrade", { colors: ["R"], cmc: 2 }),
  card("Electrolyze", { colors: ["U", "R"], cmc: 3 }),
  card("Ulamog", { cmc: 10, typeLine: "Legendary Creature — Eldrazi" }),
  card("Forest", { typeLine: "Basic Land — Forest" }),
  card("Elf", { colors: ["G"], cmc: 1, typeLine: "Creature — Elf // Land" }),
  card("Sol Ring", { cmc: 1, typeLine: "Artifact" }),
  card("Steel Golem", { cmc: 3, typeLine: "Artifact Creature — Golem" }),
  card("Dryad Arbor", { colors: ["G"], typeLine: "Land Creature — Forest Dryad" }),
  card("Rite", { colors: ["R"], cmc: 1, typeLine: "Sorcery" }),
  card("Walker", { colors: ["W"], cmc: 4, typeLine: "Legendary Planeswalker — Gideon" }),
];

function names(axis: ColumnAxis): Record<string, string[]> {
  return Object.fromEntries(
    columnsBy(cards, axis).map((column) => [column.id, column.cards.map((c) => c.name)]),
  );
}

describe("columnsBy", () => {
  it("puts every card in exactly one column by mana value and by color", () => {
    for (const axis of ["mv", "color"] as const) {
      const placed = columnsBy(cards, axis).flatMap((column) => column.cards);
      expect(placed).toHaveLength(cards.length);
      expect(new Set(placed).size).toBe(cards.length);
    }
  });

  it("matches the stats curve and color counts, with lands apart", () => {
    const stats = cubeStats(cards, []);
    const mv = columnsBy(cards, "mv");
    expect(mv.filter((c) => c.id !== "land").map((c) => c.cards.length)).toEqual(
      stats.curve.map((row) => row.count),
    );
    expect(mv.find((c) => c.id === "land")?.cards.length).toBe(stats.lands);
    const color = Object.fromEntries(columnsBy(cards, "color").map((c) => [c.id, c.cards.length]));
    const statColor = Object.fromEntries(stats.colors.map((row) => [row.id, row.count]));
    expect(color).toMatchObject({
      W: statColor["W"],
      R: statColor["R"],
      M: statColor["multicolored"],
      C: statColor["colorless"],
    });
  });

  it("sorts a mana value column by color, then name", () => {
    expect(names("mv")["1"]).toEqual(["Rite", "Shock", "Elf", "Sol Ring"]);
  });

  it("puts a card under every type on its front face", () => {
    const type = names("type");
    expect(type["creature"]).toEqual(["Dryad Arbor", "Elf", "Steel Golem", "Ulamog"]);
    expect(type["artifact"]).toEqual(["Sol Ring", "Steel Golem"]);
    expect(type["instant"]).toEqual(["Shock", "Abrade", "Electrolyze"]);
    expect(type["sorcery"]).toEqual(["Rite"]);
    expect(type["planeswalker"]).toEqual(["Walker"]);
    expect(type["land"]).toEqual(["Dryad Arbor", "Forest"]);
    expect(type["other"]).toEqual([]);
  });

  it("matches the stats card-type counts", () => {
    const stats = cubeStats(cards, []);
    expect(columnsBy(cards, "type").map((c) => c.cards.length)).toEqual(
      stats.types.map((row) => row.count),
    );
  });
});
