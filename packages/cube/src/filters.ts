import { z } from "zod";
import type { Tag } from "./schema.ts";
import type { BucketKind, StatCard } from "./stats.ts";
import { bucketId, inBucket, parseBucket } from "./stats.ts";

export const filterChipSchema = z.strictObject({
  bucket: z.string().refine((id) => parseBucket(id) !== undefined, "unknown bucket"),
  not: z.boolean().optional(),
});

export const filterSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  label: z.string().trim().min(1),
  chips: z.array(filterChipSchema),
  view: z.string().default("cards"),
});

export const filtersFileSchema = z.strictObject({
  filters: z.array(filterSchema),
});

export type FilterChip = z.infer<typeof filterChipSchema>;
export type Filter = z.infer<typeof filterSchema>;
export type FiltersFile = z.infer<typeof filtersFileSchema>;

export const EMPTY_FILTERS: FiltersFile = { filters: [] };

const ALL_OF: ReadonlySet<BucketKind> = new Set(["tag"]);

export function chipKind(chip: FilterChip): BucketKind | undefined {
  return parseBucket(chip.bucket)?.kind;
}

export function hasStatusChip(filter: Pick<Filter, "chips">): boolean {
  return filter.chips.some((chip) => !chip.not && chipKind(chip) === "status");
}

export function matchesFilter(card: StatCard, chips: readonly FilterChip[]): boolean {
  const groups = new Map<BucketKind, boolean[]>();
  for (const chip of chips) {
    const bucket = parseBucket(chip.bucket);
    if (!bucket) {
      continue;
    }
    const hit = inBucket(card, bucket);
    if (chip.not) {
      if (hit) {
        return false;
      }
      continue;
    }
    groups.set(bucket.kind, [...(groups.get(bucket.kind) ?? []), hit]);
  }
  return [...groups].every(([kind, hits]) =>
    ALL_OF.has(kind) ? hits.every(Boolean) : hits.some(Boolean),
  );
}

export function filterCards<T extends StatCard>(
  filter: Pick<Filter, "chips">,
  all: readonly T[],
  scoped: readonly T[],
): T[] {
  return (hasStatusChip(filter) ? all : scoped).filter((card) => matchesFilter(card, filter.chips));
}

export type ChipState = "off" | "with" | "without";

export function chipState(chips: readonly FilterChip[], bucket: string): ChipState {
  const chip = chips.find((candidate) => candidate.bucket === bucket);
  if (!chip) {
    return "off";
  }
  return chip.not ? "without" : "with";
}

export function cycleChip(chips: readonly FilterChip[], bucket: string): FilterChip[] {
  const state = chipState(chips, bucket);
  const rest = chips.filter((chip) => chip.bucket !== bucket);
  if (state === "off") {
    return [...rest, { bucket }];
  }
  if (state === "with") {
    return chips.map((chip) => (chip.bucket === bucket ? { bucket, not: true } : chip));
  }
  return rest;
}

function knownTag(chip: FilterChip, tags: ReadonlySet<string>): boolean {
  const bucket = parseBucket(chip.bucket);
  return bucket?.kind !== "tag" || tags.has(bucket.keys[0] ?? "");
}

export function pruneFilters(file: FiltersFile, vocabulary: readonly Tag[]): FiltersFile {
  const tags = new Set(vocabulary.map((tag) => tag.id));
  return {
    filters: file.filters.map((filter) => ({
      ...filter,
      chips: filter.chips.filter((chip) => knownTag(chip, tags)),
    })),
  };
}

export function validateFilters(file: FiltersFile, vocabulary: readonly Tag[]): string[] {
  const tags = new Set(vocabulary.map((tag) => tag.id));
  const seen = new Set<string>();
  return file.filters.flatMap((filter) => {
    const problems: string[] = [];
    if (seen.has(filter.id)) {
      problems.push(`filters.json: duplicate filter id "${filter.id}"`);
    }
    seen.add(filter.id);
    for (const chip of filter.chips) {
      if (!knownTag(chip, tags)) {
        problems.push(`filters.json: filter "${filter.id}" uses unknown tag in "${chip.bucket}"`);
      }
    }
    return problems;
  });
}

export function newFilterId(
  existing: readonly Pick<Filter, "id">[],
  random: () => string = () => Math.random().toString(36).slice(2, 8),
): string {
  const ids = new Set(existing.map((filter) => filter.id));
  let id = `filter-${random()}`;
  while (ids.has(id)) {
    id = `filter-${random()}`;
  }
  return id;
}

export function narrowTo(chips: readonly FilterChip[], bucket: string): FilterChip[] {
  const kind = parseBucket(bucket)?.kind;
  const kept = chips.filter(
    (chip) =>
      chip.bucket !== bucket &&
      (chip.not === true || ALL_OF.has(chipKind(chip) ?? "tag") || chipKind(chip) !== kind),
  );
  return [...kept, { bucket }];
}

export function tagChip(tag: string, not = false): FilterChip {
  return not ? { bucket: bucketId("tag", tag), not } : { bucket: bucketId("tag", tag) };
}
