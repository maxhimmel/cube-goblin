import type { CardEntry, Section } from "./schema.ts";
import { slugify } from "./store.ts";

export function validateCube(cards: readonly CardEntry[], sections: readonly Section[]): string[] {
  const problems: string[] = [];
  const sectionIds = new Set(sections.map((section) => section.id));
  const byOracle = new Map<string, string>();
  const bySlug = new Map<string, string>();

  for (const card of cards) {
    const sameOracle = byOracle.get(card.oracleId);
    if (sameOracle !== undefined) {
      problems.push(`Singleton violated: "${card.name}" duplicates "${sameOracle}"`);
    }
    byOracle.set(card.oracleId, card.name);

    const slug = slugify(card.name);
    const sameSlug = bySlug.get(slug);
    if (sameSlug !== undefined && sameSlug !== card.name) {
      problems.push(`Slug collision: "${card.name}" and "${sameSlug}"`);
    }
    bySlug.set(slug, card.name);

    if (card.section !== undefined && !sectionIds.has(card.section)) {
      problems.push(`"${card.name}" has unknown section "${card.section}"`);
    }
  }
  return problems;
}
