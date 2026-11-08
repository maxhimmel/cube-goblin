import type { CardEntry } from "./schema.ts";
import { applyTagChanges, cardEntrySchema, cardPatchSchema } from "./schema.ts";
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

export async function patchCard(
  paths: CubePaths,
  slug: string,
  input: unknown,
): Promise<UpdateResult> {
  const parsed = cardPatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  const current = (await readCards(paths)).find((card) => slugify(card.name) === slug);
  if (!current) {
    return { ok: false, status: 404, error: `No card "${slug}"` };
  }
  const patch = parsed.data;
  const { section: currentSection, ...base } = current;
  const nextSection = patch.section === undefined ? currentSection : (patch.section ?? undefined);
  const next: CardEntry = {
    ...base,
    status: patch.status ?? current.status,
    notes: patch.notes ?? current.notes,
    tags: applyTagChanges(current.tags, patch),
    ...(nextSection === undefined ? {} : { section: nextSection }),
  };
  return updateCard(paths, slug, next);
}
