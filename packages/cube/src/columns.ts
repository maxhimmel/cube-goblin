import type { StatCard } from "./stats.ts";
import { COLORS, CURVE_TOP, isLand } from "./stats.ts";

export const COLUMN_AXES = [
  { id: "mv", label: "Mana value" },
  { id: "color", label: "Color" },
  { id: "type", label: "Card type" },
] as const;

export type ColumnAxis = (typeof COLUMN_AXES)[number]["id"];

export interface Column<T> {
  id: string;
  label: string;
  cards: T[];
}

type ColumnCard = Pick<StatCard, "colors" | "cmc" | "typeLine"> & { name: string };

const LAND = { id: "land", label: "Land" };

const CARD_TYPES = [
  { id: "creature", label: "Creature", word: /\bCreature\b/u },
  { id: "planeswalker", label: "Planeswalker", word: /\bPlaneswalker\b/u },
  { id: "spell", label: "Instant & sorcery", word: /\b(Instant|Sorcery)\b/u },
  { id: "artifact", label: "Artifact", word: /\bArtifact\b/u },
  { id: "enchantment", label: "Enchantment", word: /\bEnchantment\b/u },
  { id: "other", label: "Other", word: /./u },
] as const;

const COLOR_ORDER = [...COLORS.map((color) => color.id), "M", "C"];

export function colorKey(card: Pick<StatCard, "colors">): string {
  if (card.colors.length === 0) {
    return "C";
  }
  if (card.colors.length > 1) {
    return "M";
  }
  return card.colors[0] ?? "C";
}

function frontType(card: Pick<StatCard, "typeLine">): string {
  return card.typeLine.split(" // ")[0] ?? "";
}

function byColorThenName(a: ColumnCard, b: ColumnCard): number {
  return (
    COLOR_ORDER.indexOf(colorKey(a)) - COLOR_ORDER.indexOf(colorKey(b)) ||
    a.cmc - b.cmc ||
    a.name.localeCompare(b.name)
  );
}

function byCostThenName(a: ColumnCard, b: ColumnCard): number {
  return a.cmc - b.cmc || byColorThenName(a, b);
}

function keyOf(card: ColumnCard, axis: ColumnAxis): string {
  if (isLand(card)) {
    return LAND.id;
  }
  if (axis === "mv") {
    return String(Math.min(Math.floor(card.cmc), CURVE_TOP));
  }
  if (axis === "color") {
    return colorKey(card);
  }
  const front = frontType(card);
  return CARD_TYPES.find((type) => type.word.test(front))?.id ?? "other";
}

function axisColumns(axis: ColumnAxis): { id: string; label: string }[] {
  if (axis === "mv") {
    return Array.from({ length: CURVE_TOP + 1 }, (_, value) => ({
      id: String(value),
      label: value === CURVE_TOP ? `${String(value)}+` : String(value),
    }));
  }
  if (axis === "color") {
    return [...COLORS, { id: "M", label: "Multicolored" }, { id: "C", label: "Colorless" }];
  }
  return CARD_TYPES.map(({ id, label }) => ({ id, label }));
}

export function columnsBy<T extends ColumnCard>(
  cards: readonly T[],
  axis: ColumnAxis,
): Column<T>[] {
  const sort = axis === "mv" ? byColorThenName : byCostThenName;
  return [...axisColumns(axis), LAND].map(({ id, label }) => ({
    id,
    label,
    cards: cards.filter((card) => keyOf(card, axis) === id).sort(sort),
  }));
}
