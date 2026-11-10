import { describe, expect, it } from "vitest";
import { creatureBalance, isOutlier, spread } from "./creatures.ts";
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

describe("spread", () => {
  it("interpolates quartiles and flags values beyond 1.5 times the middle half", () => {
    const range = spread([2, 3, 4, 4, 5, 20]);
    expect(range).toEqual({ min: 2, q1: 3.25, median: 4, q3: 4.75, max: 20 });
    expect(range && isOutlier(20, range)).toBe(true);
    expect(range && isOutlier(2, range)).toBe(false);
  });
});

describe("creatureBalance", () => {
  const balance = creatureBalance(cards);

  it("takes the median of fixed bodies and counts * and 0/0 bodies apart", () => {
    expect(balance.creatures).toBe(7);
    expect(balance.variable).toBe(2);
    expect(balance.power).toBe(1);
    expect(balance.toughness).toBe(2);
  });

  it("names the most powerful and the toughest creature", () => {
    expect(balance.strongest?.card.name).toBe("Giant");
    expect(balance.toughest?.card.name).toBe("Giant");
  });

  it("names the biggest and smallest creature by power plus toughness, then power", () => {
    expect(balance.biggest?.card.name).toBe("Giant");
    expect(balance.smallest?.card.name).toBe("Ornithopter");
  });

  it("takes the median power plus toughness per mana, skipping free creatures", () => {
    expect(balance.perMana).toBe(2);
  });

  it("breaks creatures down by mana value", () => {
    const two = balance.curve.find((row) => row.id === "2");
    expect(two).toMatchObject({
      count: 3,
      power: 1,
      toughness: 3,
      size: { min: 4, q1: 4, median: 4, q3: 4, max: 4 },
    });
    expect(two?.biggest?.card.name).toBe("Bear");
    expect(two?.smallest?.card.name).toBe("Wall");
  });
});
