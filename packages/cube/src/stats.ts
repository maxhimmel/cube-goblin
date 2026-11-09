import type { CardStatus, Tag } from "./schema.ts";
import { CARD_STATUSES } from "./schema.ts";

export const COLORS = [
  { id: "W", label: "White" },
  { id: "U", label: "Blue" },
  { id: "B", label: "Black" },
  { id: "R", label: "Red" },
  { id: "G", label: "Green" },
] as const;

export const CURVE_TOP = 7;

export interface StatCard {
  status: CardStatus;
  colors: string[];
  cmc: number;
  typeLine: string;
  tags?: string[] | undefined;
}

export interface Count {
  id: string;
  label: string;
  count: number;
}

export interface CubeStats {
  total: number;
  status: Count[];
  colors: Count[];
  curve: Count[];
  lands: number;
  tags: (Count & { kind: Tag["kind"] })[];
}

export function isLand(card: Pick<StatCard, "typeLine">): boolean {
  const front = card.typeLine.split(" // ")[0] ?? "";
  return /\bLand\b/u.test(front);
}

function count<T>(cards: readonly T[], test: (card: T) => boolean): number {
  return cards.filter(test).length;
}

export function cubeStats(cards: readonly StatCard[], vocabulary: readonly Tag[]): CubeStats {
  const spells = cards.filter((card) => !isLand(card));
  return {
    total: cards.length,
    status: CARD_STATUSES.map((status) => ({
      id: status,
      label: status,
      count: count(cards, (card) => card.status === status),
    })),
    colors: [
      ...COLORS.map((color) => ({
        id: color.id,
        label: color.label,
        count: count(spells, (card) => card.colors.length === 1 && card.colors[0] === color.id),
      })),
      {
        id: "multicolored",
        label: "Multicolored",
        count: count(spells, (card) => card.colors.length > 1),
      },
      {
        id: "colorless",
        label: "Colorless",
        count: count(spells, (card) => card.colors.length === 0),
      },
    ],
    curve: Array.from({ length: CURVE_TOP + 1 }, (_, value) => ({
      id: String(value),
      label: value === CURVE_TOP ? `${String(value)}+` : String(value),
      count: count(spells, (card) =>
        value === CURVE_TOP ? card.cmc >= CURVE_TOP : Math.floor(card.cmc) === value,
      ),
    })),
    lands: cards.length - spells.length,
    tags: vocabulary.map((tag) => ({
      id: tag.id,
      label: tag.label,
      kind: tag.kind,
      count: count(cards, (card) => card.tags?.includes(tag.id) ?? false),
    })),
  };
}
