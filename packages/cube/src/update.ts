import type { CardEntry } from "./schema.ts";
import { cardEntrySchema } from "./schema.ts";
import type { CubePaths } from "./store.ts";
import { readCards, readSections, slugify, writeCard } from "./store.ts";
import { validateCube } from "./validate.ts";

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
  const [cards, sections] = await Promise.all([readCards(paths), readSections(paths)]);
  if (!cards.some((existing) => slugify(existing.name) === slug)) {
    return { ok: false, status: 404, error: `No card "${slug}"` };
  }
  const next = cards.map((existing) => (slugify(existing.name) === slug ? card : existing));
  const problems = validateCube(next, sections);
  if (problems.length > 0) {
    return { ok: false, status: 400, error: problems.join("\n") };
  }
  await writeCard(paths, card);
  return { ok: true, card };
}
