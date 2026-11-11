import { z } from "zod";
import type { QueryCard } from "./query.ts";
import {
  bucketQuery,
  compileQuery,
  joinQuery,
  namesStatus,
  queryParts,
  removePart,
  tagsIn,
} from "./query.ts";
import type { Tag } from "./schema.ts";
import type { Bucket } from "./stats.ts";
import { parseBucket } from "./stats.ts";

const legacyChipSchema = z.object({ bucket: z.string(), not: z.boolean().optional() });

function wrap(query: string): string {
  return queryParts(query).length > 1 || /\sor\s/iu.test(query) ? `(${query})` : query;
}

export function chipsToQuery(chips: readonly z.infer<typeof legacyChipSchema>[]): string {
  const positive = new Map<string, string[]>();
  const negative: string[] = [];
  for (const chip of chips) {
    const bucket = parseBucket(chip.bucket);
    if (!bucket) {
      continue;
    }
    const query = bucketQuery(bucket);
    if (chip.not) {
      negative.push(`-${wrap(query)}`);
      continue;
    }
    const key = bucket.kind === "tag" ? chip.bucket : bucket.kind;
    positive.set(key, [...(positive.get(key) ?? []), query]);
  }
  const groups = [...positive.values()].map((queries) =>
    queries.length === 1 ? (queries[0] ?? "") : `(${queries.join(" or ")})`,
  );
  return joinQuery(...groups, ...negative);
}

function upgrade(input: unknown): unknown {
  if (typeof input !== "object" || input === null || !("chips" in input) || "query" in input) {
    return input;
  }
  const { chips, ...rest } = input;
  const parsed = z.array(legacyChipSchema).safeParse(chips);
  return parsed.success ? { ...rest, query: chipsToQuery(parsed.data) } : input;
}

export const filterSchema = z.preprocess(
  upgrade,
  z.strictObject({
    id: z.string().regex(/^[a-z0-9-]+$/u),
    label: z.string().trim().min(1),
    query: z.string().refine((query) => compileQuery(query).ok, "query doesn't parse"),
    view: z.string().default("cards"),
  }),
);

export const filtersFileSchema = z.strictObject({
  filters: z.array(filterSchema),
});

export type Filter = z.infer<typeof filterSchema>;
export type FiltersFile = z.infer<typeof filtersFileSchema>;

export const EMPTY_FILTERS: FiltersFile = { filters: [] };

export function filterTest(filter: Pick<Filter, "query">): (card: QueryCard) => boolean {
  const result = compileQuery(filter.query);
  return result.ok ? result.test : () => false;
}

export function filterCards<T extends QueryCard>(
  filter: Pick<Filter, "query">,
  all: readonly T[],
  scoped: readonly T[],
): T[] {
  const test = filterTest(filter);
  return (namesStatus(filter.query) ? all : scoped).filter(test);
}

export function pruneQuery(query: string, tags: ReadonlySet<string>): string {
  let next = query;
  for (const part of queryParts(query).toReversed()) {
    if (tagsIn(part.text).some((tag) => !tags.has(tag))) {
      next = removePart(next, part);
    }
  }
  return next;
}

export function pruneFilters(file: FiltersFile, vocabulary: readonly Tag[]): FiltersFile {
  const tags = new Set(vocabulary.map((tag) => tag.id));
  return {
    filters: file.filters.map((filter) => ({ ...filter, query: pruneQuery(filter.query, tags) })),
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
    const result = compileQuery(filter.query);
    if (!result.ok) {
      problems.push(`filters.json: filter "${filter.id}": ${result.error}`);
    }
    for (const tag of tagsIn(filter.query)) {
      if (!tags.has(tag)) {
        problems.push(`filters.json: filter "${filter.id}" uses unknown tag "${tag}"`);
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

export function narrowTo(query: string, bucket: Bucket): string {
  return joinQuery(query, bucketQuery(bucket));
}
