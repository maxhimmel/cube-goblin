import { describe, expect, it } from "vitest";
import { creatureBalance } from "./creatures.ts";
import type { StatCard } from "./stats.ts";

type Card = StatCard & { name: string };

function card(name: string, cmc: number, power: string, toughness: string): Card {
  return { name, status: "draft", colors: [], cmc, typeLine: "Creature — Test", power, toughness };
}

const cards: Card[] = [
  card("Elf", 1, "1", "1"),
  card("Bear", 2, "2", "2"),
  card("Wall", 2, "0", "4"),
  card("Giant", 6, "7", "7"),
  card("Tarmogoyf", 2, "*", "1+*"),
  card("Ornithopter", 0, "0", "2"),
  card("Hydra", 3, "0", "0"),
  { name: "Bolt", status: "draft", colors: ["R"], cmc: 1, typeLine: "Instant" },
];

describe("creatureBalance", () => {
  const balance = creatureBalance(cards);

  it("averages fixed bodies and counts * and 0/0 bodies apart", () => {
    expect(balance.creatures).toBe(7);
    expect(balance.variable).toBe(2);
    expect(balance.power).toBe(2);
    expect(balance.toughness).toBe(3.2);
  });

  it("names the biggest and smallest creature by power plus toughness, then power", () => {
    expect(balance.biggest?.card.name).toBe("Giant");
    expect(balance.smallest?.card.name).toBe("Ornithopter");
  });

  it("averages power plus toughness per mana, skipping free creatures", () => {
    expect(balance.perMana).toBeCloseTo((2 + 2 + 2 + 14 / 6) / 4);
  });

  it("breaks creatures down by mana value", () => {
    const two = balance.curve.find((row) => row.id === "2");
    expect(two).toMatchObject({ count: 3, power: 1, toughness: 3 });
    expect(two?.biggest?.card.name).toBe("Bear");
    expect(two?.smallest?.card.name).toBe("Wall");
  });
});
