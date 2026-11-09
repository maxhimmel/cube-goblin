import type { CardEntry } from "./schema.ts";
import { applyCardPatch, cardChangesSchema, cardEntrySchema } from "./schema.ts";
import type { CubePaths } from "./store.ts";
import { slugify } from "./slug.ts";
import { readCards, readSections, readTags, writeCard } from "./store.ts";
import { validateCube } from "./validate.ts";

const IDENTITY_FIELDS = ["name", "oracleId", "source"] as const;

export type UpdateResult =
  { ok: true; card: CardEntry } | { ok: false; status: 400 | 404; error: string };

export async function updateCard(
  paths: CubePaths,
  slug: string,
  input: unknown,
): Promise<UpdateResult> {
  const parsed = cardEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  const card = parsed.data;
  if (slugify(card.name) !== slug) {
    return { ok: false, status: 400, error: `Name "${card.name}" does not match slug "${slug}"` };
  }
  const [cards, sections, tags] = await Promise.all([
    readCards(paths),
    readSections(paths),
    readTags(paths),
  ]);
  const current = cards.find((existing) => slugify(existing.name) === slug);
  if (!current) {
    return { ok: false, status: 404, error: `No card "${slug}"` };
  }
  const changed = IDENTITY_FIELDS.filter(
    (field) => JSON.stringify(current[field]) !== JSON.stringify(card[field]),
  );
  if (changed.length > 0) {
    return { ok: false, status: 400, error: `Cannot change ${changed.join(", ")}` };
  }
  const next = cards.map((existing) => (slugify(existing.name) === slug ? card : existing));
  const problems = validateCube(next, sections, tags);
  if (problems.length > 0) {
    return { ok: false, status: 400, error: problems.join("\n") };
  }
  await writeCard(paths, card);
  return { ok: true, card };
}

export type BatchResult =
  { ok: true; cards: CardEntry[] } | { ok: false; status: 400 | 404; error: string };

export async function patchCards(paths: CubePaths, input: unknown): Promise<BatchResult> {
  const parsed = cardChangesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  const [cards, sections, tags] = await Promise.all([
    readCards(paths),
    readSections(paths),
    readTags(paths),
  ]);
  const bySlug = new Map(cards.map((card) => [slugify(card.name), card]));
  const changed = new Map<string, CardEntry>();
  for (const { slug, patch } of parsed.data.changes) {
    const current = changed.get(slug) ?? bySlug.get(slug);
    if (!current) {
      return { ok: false, status: 404, error: `No card "${slug}"` };
    }
    changed.set(slug, applyCardPatch(current, patch));
  }
  const next = cards.map((card) => changed.get(slugify(card.name)) ?? card);
  const problems = validateCube(next, sections, tags);
  if (problems.length > 0) {
    return { ok: false, status: 400, error: problems.join("\n") };
  }
  for (const card of changed.values()) {
    await writeCard(paths, card);
  }
  return { ok: true, cards: [...changed.values()] };
}

export async function patchCard(
  paths: CubePaths,
  slug: string,
  input: unknown,
): Promise<UpdateResult> {
  const result = await patchCards(paths, { changes: [{ slug, patch: input }] });
  if (!result.ok) {
    return result;
  }
  const [card] = result.cards;
  return card ? { ok: true, card } : { ok: false, status: 404, error: `No card "${slug}"` };
}
