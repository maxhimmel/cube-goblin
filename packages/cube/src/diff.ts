import { z } from "zod";
import type { Board, CardEntry, StatusCounts, Tag } from "./schema.ts";
import { cardStatusSchema, statusCountsSchema, tagSchema } from "./schema.ts";
import { slugify } from "./slug.ts";

export const CURRENT = "current";

export interface CubeState {
  cards: readonly CardEntry[];
  tags: readonly Tag[];
  board: Board;
}

export const cardDiffSchema = z.strictObject({
  slug: z.string(),
  name: z.string(),
  before: cardStatusSchema.optional(),
  after: cardStatusSchema.optional(),
  tagsAdded: z.array(z.string()),
  tagsRemoved: z.array(z.string()),
  notesChanged: z.boolean(),
  printingChanged: z.boolean(),
});

export const sectionDiffSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  change: z.enum(["added", "removed", "changed"]),
  renamedFrom: z.string().optional(),
  cardsAdded: z.array(z.string()),
  cardsRemoved: z.array(z.string()),
  tagsAdded: z.array(z.string()),
  tagsRemoved: z.array(z.string()),
});

export const cubeDiffSchema = z.strictObject({
  cards: z.array(cardDiffSchema),
  tags: z.strictObject({
    added: z.array(tagSchema),
    removed: z.array(tagSchema),
    changed: z.array(z.strictObject({ before: tagSchema, after: tagSchema })),
  }),
  sections: z.array(sectionDiffSchema),
  counts: z.strictObject({ before: statusCountsSchema, after: statusCountsSchema }),
});

export type CardDiff = z.infer<typeof cardDiffSchema>;
export type SectionDiff = z.infer<typeof sectionDiffSchema>;
export type CubeDiff = z.infer<typeof cubeDiffSchema>;

export function statusCounts(cards: readonly CardEntry[]): StatusCounts {
  const counts: StatusCounts = { draft: 0, prospect: 0, cut: 0 };
  for (const card of cards) {
    counts[card.status] += 1;
  }
  return counts;
}

function added(before: readonly string[], after: readonly string[]): string[] {
  return after.filter((item) => !before.includes(item));
}

function cardDiff(before: CardEntry | undefined, after: CardEntry | undefined): CardDiff {
  const card = after ?? before;
  const beforeTags = before?.tags ?? [];
  const afterTags = after?.tags ?? [];
  const both = before !== undefined && after !== undefined;
  return {
    slug: slugify(card?.name ?? ""),
    name: card?.name ?? "",
    ...(before === undefined ? {} : { before: before.status }),
    ...(after === undefined ? {} : { after: after.status }),
    tagsAdded: both ? added(beforeTags, afterTags) : [],
    tagsRemoved: both ? added(afterTags, beforeTags) : [],
    notesChanged: both && before.notes !== after.notes,
    printingChanged: both && before.printing !== after.printing,
  };
}

export function isCardChanged(diff: CardDiff): boolean {
  return (
    diff.before !== diff.after ||
    diff.tagsAdded.length + diff.tagsRemoved.length > 0 ||
    diff.notesChanged ||
    diff.printingChanged
  );
}

function diffTags(before: readonly Tag[], after: readonly Tag[]): CubeDiff["tags"] {
  const old = new Map(before.map((tag) => [tag.id, tag]));
  const next = new Map(after.map((tag) => [tag.id, tag]));
  return {
    added: after.filter((tag) => !old.has(tag.id)),
    removed: before.filter((tag) => !next.has(tag.id)),
    changed: after.flatMap((tag) => {
      const was = old.get(tag.id);
      return was && (was.label !== tag.label || was.kind !== tag.kind)
        ? [{ before: was, after: tag }]
        : [];
    }),
  };
}

function diffSections(before: Board, after: Board): SectionDiff[] {
  const old = new Map(before.sections.map((section) => [section.id, section]));
  const next = new Map(after.sections.map((section) => [section.id, section]));
  const diffs: SectionDiff[] = [];
  for (const section of after.sections) {
    const was = old.get(section.id);
    const diff: SectionDiff = {
      id: section.id,
      label: section.label,
      change: was ? "changed" : "added",
      ...(was && was.label !== section.label ? { renamedFrom: was.label } : {}),
      cardsAdded: added(was?.cards ?? [], section.cards),
      cardsRemoved: added(section.cards, was?.cards ?? []),
      tagsAdded: added(was?.tags ?? [], section.tags),
      tagsRemoved: added(section.tags, was?.tags ?? []),
    };
    const changed =
      diff.change === "added" ||
      diff.renamedFrom !== undefined ||
      diff.cardsAdded.length +
        diff.cardsRemoved.length +
        diff.tagsAdded.length +
        diff.tagsRemoved.length >
        0;
    if (changed) {
      diffs.push(diff);
    }
  }
  for (const section of before.sections) {
    if (!next.has(section.id)) {
      diffs.push({
        id: section.id,
        label: section.label,
        change: "removed",
        cardsAdded: [],
        cardsRemoved: section.cards,
        tagsAdded: [],
        tagsRemoved: section.tags,
      });
    }
  }
  return diffs;
}

export function diffCube(before: CubeState, after: CubeState): CubeDiff {
  const old = new Map(before.cards.map((card) => [card.oracleId, card]));
  const next = new Map(after.cards.map((card) => [card.oracleId, card]));
  const ids = new Set([...old.keys(), ...next.keys()]);
  const cards = [...ids]
    .map((id) => cardDiff(old.get(id), next.get(id)))
    .filter(isCardChanged)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    cards,
    tags: diffTags(before.tags, after.tags),
    sections: diffSections(before.board, after.board),
    counts: { before: statusCounts(before.cards), after: statusCounts(after.cards) },
  };
}
