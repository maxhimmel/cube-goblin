import type { CardStatus, Tag } from "./schema.ts";
import type { StatCard } from "./stats.ts";
import { inBucket, isLand, parseBucket } from "./stats.ts";

export const COMPARE_SCOPES = ["draft", "all"] as const;
export type CompareScope = (typeof COMPARE_SCOPES)[number];

export const COMPARE_UNITS = ["share", "count"] as const;
export type CompareUnit = (typeof COMPARE_UNITS)[number];

export const UNMATCHED_TAG = "~";

export function inCompareScope(card: { status: CardStatus }, scope: CompareScope): boolean {
  return scope === "all" || card.status === "draft";
}

export function tagKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s_:-]+/gu, " ");
}

export interface TagMatch {
  ids: ReadonlyMap<string, string>;
  unmatched: Tag[];
}

export function matchTags(mine: readonly Tag[], theirs: readonly Tag[]): TagMatch {
  const byKey = new Map<string, string>();
  for (const tag of mine) {
    byKey.set(tagKey(tag.id), tag.id);
    byKey.set(tagKey(tag.label), tag.id);
  }
  const ids = new Map<string, string>();
  const unmatched: Tag[] = [];
  for (const tag of theirs) {
    const found = byKey.get(tagKey(tag.label)) ?? byKey.get(tagKey(tag.id));
    if (found === undefined) {
      unmatched.push(tag);
    } else {
      ids.set(tag.id, found);
    }
  }
  return { ids, unmatched };
}

export function translateTags<T extends { tags: string[] }>(
  cards: readonly T[],
  match: TagMatch,
): T[] {
  return cards.map((card) => ({
    ...card,
    tags: card.tags.map((tag) => match.ids.get(tag) ?? `${UNMATCHED_TAG}${tag}`),
  }));
}

export interface TagCount {
  tag: Tag;
  count: number;
}

export function unmatchedTagCounts(
  cards: readonly { tags: readonly string[] }[],
  match: TagMatch,
): TagCount[] {
  return match.unmatched
    .map((tag) => ({
      tag,
      count: cards.filter(
        (card) => card.tags.includes(tag.id) || card.tags.includes(`${UNMATCHED_TAG}${tag.id}`),
      ).length,
    }))
    .filter((entry) => entry.count > 0)
    .toSorted((a, b) => b.count - a.count || a.tag.label.localeCompare(b.tag.label));
}

export interface CardOverlap<T> {
  shared: T[];
  onlyHere: T[];
  onlyThere: T[];
}

export function cardOverlap<T extends { oracleId: string; name: string }>(
  here: readonly T[],
  there: readonly T[],
): CardOverlap<T> {
  const hereIds = new Set(here.map((card) => card.oracleId));
  const thereIds = new Set(there.map((card) => card.oracleId));
  const byName = (a: T, b: T): number => a.name.localeCompare(b.name);
  return {
    shared: here.filter((card) => thereIds.has(card.oracleId)).toSorted(byName),
    onlyHere: here.filter((card) => !thereIds.has(card.oracleId)).toSorted(byName),
    onlyThere: there.filter((card) => !hereIds.has(card.oracleId)).toSorted(byName),
  };
}

export function scaled(count: number, theirTotal: number, ourTotal: number): number {
  return theirTotal === 0 ? 0 : (count * ourTotal) / theirTotal;
}

export function statTest(id: string): ((card: StatCard) => boolean) | undefined {
  if (id === "cards") {
    return () => true;
  }
  if (id === "nonland") {
    return (card) => !isLand(card);
  }
  const bucket = parseBucket(id);
  return bucket && ((card) => inBucket(card, bucket));
}

export interface GroupCell {
  count: number;
  share: number;
  delta: number;
}

export interface GroupRow {
  id: string;
  mean: number;
  cells: GroupCell[];
}

export function groupAverage(
  cubes: readonly (readonly StatCard[])[],
  ids: readonly string[],
): GroupRow[] {
  return ids.flatMap((id) => {
    const test = statTest(id);
    if (!test) {
      return [];
    }
    const counts = cubes.map((cards) => ({
      count: cards.filter(test).length,
      total: cards.length,
    }));
    const shares = counts.map(({ count, total }) => (total === 0 ? 0 : count / total));
    const mean =
      shares.length === 0 ? 0 : shares.reduce((sum, share) => sum + share, 0) / shares.length;
    return [
      {
        id,
        mean,
        cells: counts.map(({ count }, index) => {
          const share = shares[index] ?? 0;
          return { count, share, delta: share - mean };
        }),
      },
    ];
  });
}

export interface PooledTags<T> {
  tags: Tag[];
  cubes: T[][];
}

export function poolTags<T extends { tags: string[] }>(
  cubes: readonly { cards: readonly T[]; vocabulary: readonly Tag[] }[],
): PooledTags<T> {
  const labels = new Map<string, string>();
  const aliases = new Map<string, string>();
  const pooled = cubes.map(({ cards, vocabulary }) => {
    const keyOf = new Map<string, string>();
    for (const tag of vocabulary) {
      const byLabel = tagKey(tag.label);
      const byId = tagKey(tag.id);
      const key = aliases.get(byLabel) ?? aliases.get(byId) ?? byLabel;
      aliases.set(byLabel, aliases.get(byLabel) ?? key);
      aliases.set(byId, aliases.get(byId) ?? key);
      keyOf.set(tag.id, key);
      if (!labels.has(key)) {
        labels.set(key, tag.label);
      }
    }
    return cards.map((card) => ({
      ...card,
      tags: card.tags.flatMap((tag) => keyOf.get(tag) ?? []),
    }));
  });
  const tags = [...labels].map(([id, label]) => ({ id, label }));
  return { tags, cubes: pooled };
}

export interface Standout {
  id: string;
  cube: number;
  share: number;
  mean: number;
  delta: number;
}

export function standouts(rows: readonly GroupRow[], atLeast = 0): Standout[] {
  return rows
    .flatMap((row) => {
      const best = row.cells.reduce<{ cube: number; delta: number } | undefined>(
        (found, cell, cube) =>
          found === undefined ||
          Math.abs(cell.delta) > Math.abs(found.delta) ||
          (Math.abs(cell.delta) === Math.abs(found.delta) && cell.delta > found.delta)
            ? { cube, delta: cell.delta }
            : found,
        undefined,
      );
      const cell = best && row.cells[best.cube];
      return best && cell && Math.abs(best.delta) >= atLeast && best.delta !== 0
        ? [{ id: row.id, cube: best.cube, share: cell.share, mean: row.mean, delta: best.delta }]
        : [];
    })
    .toSorted((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function averageManaValue(cards: readonly StatCard[]): number | undefined {
  const spells = cards.filter((card) => !isLand(card));
  return spells.length === 0
    ? undefined
    : spells.reduce((sum, card) => sum + card.cmc, 0) / spells.length;
}
