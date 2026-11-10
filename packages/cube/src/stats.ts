import { CARD_FUNCTIONS } from "./functions.ts";
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

export const CARD_TYPES = [
  { id: "creature", label: "Creature", word: /\bCreature\b/u },
  { id: "planeswalker", label: "Planeswalker", word: /\bPlaneswalker\b/u },
  { id: "instant", label: "Instant", word: /\bInstant\b/u },
  { id: "sorcery", label: "Sorcery", word: /\bSorcery\b/u },
  { id: "artifact", label: "Artifact", word: /\bArtifact\b/u },
  { id: "enchantment", label: "Enchantment", word: /\bEnchantment\b/u },
  { id: "battle", label: "Battle", word: /\bBattle\b/u },
] as const;

export const OTHER_TYPE = { id: "other", label: "Other" } as const;

export const LAND = { id: "land", label: "Land" } as const;

export const TYPE_COLUMNS: readonly Omit<Count, "count">[] = [
  ...CARD_TYPES.map(({ id, label }) => ({ id, label })),
  OTHER_TYPE,
  LAND,
];

export interface StatCard {
  status: CardStatus;
  colors: string[];
  cmc: number;
  typeLine: string;
  manaCost?: string | undefined;
  tags?: string[] | undefined;
  functions?: readonly string[] | undefined;
}

export interface Count {
  id: string;
  label: string;
  count: number;
}

export interface GridCell {
  row: string;
  column: string;
  count: number;
}

export interface CubeStats {
  total: number;
  status: Count[];
  colors: Count[];
  pips: Count[];
  curve: Count[];
  colorCurve: GridCell[];
  lands: number;
  creatures: number;
  types: Count[];
  functions: Count[];
  tags: (Count & { kind: Tag["kind"] })[];
}

export function frontType(card: Pick<StatCard, "typeLine">): string {
  return card.typeLine.split(" // ")[0] ?? "";
}

export function isLand(card: Pick<StatCard, "typeLine">): boolean {
  return /\bLand\b/u.test(frontType(card));
}

export function typeKeys(card: Pick<StatCard, "typeLine">): string[] {
  const front = frontType(card);
  const keys: string[] = CARD_TYPES.filter((type) => type.word.test(front)).map((type) => type.id);
  if (isLand(card)) {
    keys.push(LAND.id);
  }
  return keys.length > 0 ? keys : [OTHER_TYPE.id];
}

export function typeKey(card: Pick<StatCard, "typeLine">): string {
  return isLand(card) ? LAND.id : (typeKeys(card)[0] ?? OTHER_TYPE.id);
}

export function colorGroup(card: Pick<StatCard, "colors">): string {
  if (card.colors.length === 0) {
    return "colorless";
  }
  return card.colors.length > 1 ? "multicolored" : (card.colors[0] ?? "colorless");
}

export function curveKey(card: Pick<StatCard, "cmc">): string {
  return String(Math.min(Math.floor(card.cmc), CURVE_TOP));
}

export const COLOR_GROUPS: readonly Omit<Count, "count">[] = [
  ...COLORS,
  { id: "multicolored", label: "Multicolored" },
  { id: "colorless", label: "Colorless" },
];

export const CURVE_COLUMNS: readonly Omit<Count, "count">[] = Array.from(
  { length: CURVE_TOP + 1 },
  (_, value) => ({
    id: String(value),
    label: value === CURVE_TOP ? `${String(value)}+` : String(value),
  }),
);

export function pipColors(manaCost: string): string[] {
  const colors: string[] = [];
  for (const [, symbol = ""] of manaCost.matchAll(/\{([^}]+)\}/gu)) {
    for (const color of COLORS) {
      if (symbol.split("/").includes(color.id)) {
        colors.push(color.id);
      }
    }
  }
  return colors;
}

function count<T>(cards: readonly T[], test: (card: T) => boolean): number {
  return cards.filter(test).length;
}

export function cubeStats(cards: readonly StatCard[], vocabulary: readonly Tag[]): CubeStats {
  const spells = cards.filter((card) => !isLand(card));
  const pips = cards.flatMap((card) => pipColors(card.manaCost ?? ""));
  return {
    total: cards.length,
    status: CARD_STATUSES.map((status) => ({
      id: status,
      label: status,
      count: count(cards, (card) => card.status === status),
    })),
    colors: COLOR_GROUPS.map((group) => ({
      ...group,
      count: count(spells, (card) => colorGroup(card) === group.id),
    })),
    pips: COLORS.map((color) => ({
      ...color,
      count: pips.filter((pip) => pip === color.id).length,
    })),
    curve: CURVE_COLUMNS.map((column) => ({
      ...column,
      count: count(spells, (card) => curveKey(card) === column.id),
    })),
    colorCurve: COLOR_GROUPS.flatMap((group) =>
      CURVE_COLUMNS.map((column) => ({
        row: group.id,
        column: column.id,
        count: count(
          spells,
          (card) => colorGroup(card) === group.id && curveKey(card) === column.id,
        ),
      })),
    ),
    lands: cards.length - spells.length,
    creatures: count(cards, (card) => typeKeys(card).includes("creature")),
    types: TYPE_COLUMNS.map(({ id, label }) => ({
      id,
      label,
      count: count(cards, (card) => typeKeys(card).includes(id)),
    })),
    functions: CARD_FUNCTIONS.map(({ id, label }) => ({
      id,
      label,
      count: count(cards, (card) => card.functions?.includes(id) ?? false),
    })),
    tags: vocabulary.map((tag) => ({
      id: tag.id,
      label: tag.label,
      kind: tag.kind,
      count: count(cards, (card) => card.tags?.includes(tag.id) ?? false),
    })),
  };
}

export const BUCKET_KINDS = [
  "curve",
  "color",
  "colorCurve",
  "pips",
  "type",
  "function",
  "status",
  "tag",
] as const;

export type BucketKind = (typeof BUCKET_KINDS)[number];

export interface Bucket {
  kind: BucketKind;
  keys: string[];
}

export function bucketId(kind: BucketKind, ...keys: string[]): string {
  return [kind, ...keys].join(":");
}

export function parseBucket(id: string): Bucket | undefined {
  const [kind, ...keys] = id.split(":");
  const known = BUCKET_KINDS.find((candidate) => candidate === kind);
  return known && keys.length > 0 ? { kind: known, keys } : undefined;
}

export function inBucket(card: StatCard, bucket: Bucket): boolean {
  const [first = "", second = ""] = bucket.keys;
  const spell = !isLand(card);
  switch (bucket.kind) {
    case "curve":
      return spell && curveKey(card) === first;
    case "color":
      return spell && colorGroup(card) === first;
    case "colorCurve":
      return spell && colorGroup(card) === first && curveKey(card) === second;
    case "pips":
      return pipColors(card.manaCost ?? "").includes(first);
    case "type":
      return typeKeys(card).includes(first);
    case "function":
      return card.functions?.includes(first) ?? false;
    case "status":
      return card.status === first;
    case "tag":
      return card.tags?.includes(first) ?? false;
  }
}
