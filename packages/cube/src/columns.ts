import type { StatCard } from "./stats.ts";
import { CARD_TYPES, COLORS, CURVE_COLUMNS, LAND, curveKey, isLand, typeKey } from "./stats.ts";

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
    return curveKey(card);
  }
  if (axis === "color") {
    return colorKey(card);
  }
  return typeKey(card);
}

function axisColumns(axis: ColumnAxis): { id: string; label: string }[] {
  if (axis === "mv") {
    return [...CURVE_COLUMNS];
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
