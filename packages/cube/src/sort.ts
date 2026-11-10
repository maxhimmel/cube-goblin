import { COLOR_ORDER, colorKey } from "./columns.ts";
import type { StatCard } from "./stats.ts";
import { TYPE_COLUMNS, typeKey } from "./stats.ts";

export const CARD_SORTS = [
  { id: "added", label: "Added" },
  { id: "name", label: "Name" },
  { id: "mv", label: "Mana value" },
  { id: "color", label: "Color" },
  { id: "type", label: "Card type" },
] as const;

export type CardSort = (typeof CARD_SORTS)[number]["id"];

type SortCard = Pick<StatCard, "colors" | "cmc" | "typeLine"> & { name: string };

const TYPE_ORDER: string[] = TYPE_COLUMNS.map((type) => type.id);

const COMPARE: Record<Exclude<CardSort, "added">, (a: SortCard, b: SortCard) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  mv: (a, b) => a.cmc - b.cmc,
  color: (a, b) => COLOR_ORDER.indexOf(colorKey(a)) - COLOR_ORDER.indexOf(colorKey(b)),
  type: (a, b) => TYPE_ORDER.indexOf(typeKey(a)) - TYPE_ORDER.indexOf(typeKey(b)),
};

export function isCardSort(value: string): value is CardSort {
  return CARD_SORTS.some((sort) => sort.id === value);
}

type Compare = (a: SortCard, b: SortCard) => number;

export function sortCards<T extends SortCard>(cards: readonly T[], keys: readonly CardSort[]): T[] {
  const compares: Compare[] = [];
  for (const key of keys) {
    if (key === "added") {
      break;
    }
    compares.push(COMPARE[key]);
  }
  if (compares.length === 0) {
    return [...cards];
  }
  compares.push(COMPARE.name);
  return [...cards].sort((a, b) => {
    for (const compare of compares) {
      const order = compare(a, b);
      if (order !== 0) {
        return order;
      }
    }
    return 0;
  });
}
