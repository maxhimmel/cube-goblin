import type { Tag } from "./schema.ts";

export interface Tagged {
  tags: readonly string[];
}

export interface TagFilter {
  with: readonly string[];
  without: readonly string[];
}

export interface Overlap<T extends Tagged> {
  key: string;
  tags: string[];
  cards: T[];
}

export function overlapKey(tags: readonly string[]): string {
  return tags.join("+");
}

export function matchesTags(card: Tagged, filter: TagFilter): boolean {
  return (
    filter.with.every((tag) => card.tags.includes(tag)) &&
    !filter.without.some((tag) => card.tags.includes(tag))
  );
}

export function overlapFilter(picked: readonly string[], tags: readonly string[]): TagFilter {
  return { with: [...tags], without: picked.filter((tag) => !tags.includes(tag)) };
}

function pickedOrder(
  picked: readonly string[],
  a: readonly string[],
  b: readonly string[],
): number {
  for (let index = 0; index < a.length; index += 1) {
    const difference = picked.indexOf(a[index] ?? "") - picked.indexOf(b[index] ?? "");
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

export function tagOverlaps<T extends Tagged>(
  cards: readonly T[],
  picked: readonly string[],
): Overlap<T>[] {
  const overlaps = new Map<string, Overlap<T>>();
  for (const card of cards) {
    const tags = picked.filter((tag) => card.tags.includes(tag));
    const key = overlapKey(tags);
    const overlap = overlaps.get(key) ?? { key, tags, cards: [] };
    overlap.cards.push(card);
    overlaps.set(key, overlap);
  }
  return [...overlaps.values()].sort(
    (a, b) =>
      Number(a.tags.length === 0) - Number(b.tags.length === 0) ||
      b.cards.length - a.cards.length ||
      b.tags.length - a.tags.length ||
      pickedOrder(picked, a.tags, b.tags),
  );
}

export function parseTagList(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }
  return [...new Set(value.split(",").filter((tag) => tag !== ""))];
}

export function tagLabel(id: string, vocabulary: readonly Tag[]): string {
  return vocabulary.find((tag) => tag.id === id)?.label ?? id;
}

export function tagCounts(cards: readonly Tagged[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const tag of card.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

export function cardCount(count: number): string {
  return `${String(count)} ${count === 1 ? "card" : "cards"}`;
}

export function describeFilter(filter: TagFilter, vocabulary: readonly Tag[]): string {
  const names = (ids: readonly string[], joiner: string): string =>
    ids.map((id) => tagLabel(id, vocabulary)).join(joiner);
  if (filter.with.length === 0) {
    return filter.without.length === 0 ? "Every card" : `None of ${names(filter.without, " or ")}`;
  }
  const tagged = names(filter.with, " + ");
  return filter.without.length === 0 ? tagged : `${tagged}, not ${names(filter.without, " or ")}`;
}
