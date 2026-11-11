import { COLOR_ORDER, colorKey } from "./columns.ts";
import type { StatCard } from "./stats.ts";
import { TYPE_COLUMNS, typeKey } from "./stats.ts";

export const CARD_SORTS = [
  { id: "added", label: "Added" },
  { id: "name", label: "Name" },
  { id: "mv", label: "Mana value" },
  { id: "color", label: "Color" },
  { id: "type", label: "Card type" },
  { id: "power", label: "Power" },
  { id: "toughness", label: "Toughness" },
] as const;

export type CardSort = (typeof CARD_SORTS)[number]["id"];

type SortCard = Pick<StatCard, "colors" | "cmc" | "typeLine" | "power" | "toughness"> & {
  name: string;
};

function stat(value: string | undefined): number {
  return value !== undefined && /^\d+$/u.test(value) ? Number(value) : Number.POSITIVE_INFINITY;
}

function byStat(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

const TYPE_ORDER: string[] = TYPE_COLUMNS.map((type) => type.id);

const COMPARE: Record<Exclude<CardSort, "added">, (a: SortCard, b: SortCard) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  mv: (a, b) => a.cmc - b.cmc,
  color: (a, b) => COLOR_ORDER.indexOf(colorKey(a)) - COLOR_ORDER.indexOf(colorKey(b)),
  type: (a, b) => TYPE_ORDER.indexOf(typeKey(a)) - TYPE_ORDER.indexOf(typeKey(b)),
  power: (a, b) => byStat(stat(a.power), stat(b.power)),
  toughness: (a, b) => byStat(stat(a.toughness), stat(b.toughness)),
};

export function isCardSort(value: string): value is CardSort {
  return CARD_SORTS.some((sort) => sort.id === value);
}

export function parseSortKeys(param: string | undefined): CardSort[] {
  const keys = [...new Set((param ?? "").split(".").filter(isCardSort))];
  return keys[0] === "added" ? ["added"] : keys.filter((key) => key !== "added");
}

export function formatSortKeys(keys: readonly CardSort[]): string | undefined {
  const kept = parseSortKeys(keys.join("."));
  return kept.length === 0 || kept[0] === "added" ? undefined : kept.join(".");
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
