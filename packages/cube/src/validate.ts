import type { CardEntry, Section, Tag } from "./schema.ts";
import { slugify } from "./slug.ts";

export function validateCube(
  cards: readonly CardEntry[],
  sections: readonly Section[],
  tags: readonly Tag[],
): string[] {
  const problems: string[] = [];
  const tagIds = new Set<string>();
  const tagLabels = new Set<string>();
  for (const tag of tags) {
    if (tagIds.has(tag.id)) {
      problems.push(`Duplicate tag "${tag.id}" in tags.json`);
    }
    tagIds.add(tag.id);
    const label = tag.label.trim().toLowerCase();
    if (tagLabels.has(label)) {
      problems.push(`Duplicate tag label "${tag.label}" in tags.json`);
    }
    tagLabels.add(label);
  }
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

    for (const tag of card.tags) {
      if (!tagIds.has(tag)) {
        problems.push(`"${card.name}" has tag "${tag}", which is not in tags.json`);
      }
    }
    if (new Set(card.tags).size !== card.tags.length) {
      problems.push(`"${card.name}" lists a tag more than once`);
    }
  }
  return problems;
}
