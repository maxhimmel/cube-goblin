import type { Section, Board, CardEntry, Tag } from "./schema.ts";
import { slugify } from "./slug.ts";

export const EMPTY_BOARD: Board = { sections: [] };

export function validateBoard(
  board: Board,
  cards: readonly CardEntry[],
  tags: readonly Tag[],
): string[] {
  const problems: string[] = [];
  const slugs = new Set(cards.map((card) => slugify(card.name)));
  const tagIds = new Set(tags.map((tag) => tag.id));
  const sectionIds = new Set<string>();
  for (const section of board.sections) {
    if (sectionIds.has(section.id)) {
      problems.push(`Duplicate section "${section.id}" in board.json`);
    }
    sectionIds.add(section.id);
    for (const slug of section.cards) {
      if (!slugs.has(slug)) {
        problems.push(`Section "${section.label}" holds "${slug}", which is not in cube/cards`);
      }
    }
    if (new Set(section.cards).size !== section.cards.length) {
      problems.push(`Section "${section.label}" lists a card more than once`);
    }
    if (section.tag !== undefined && !tagIds.has(section.tag)) {
      problems.push(
        `Section "${section.label}" links tag "${section.tag}", which is not in tags.json`,
      );
    }
  }
  return problems;
}

export function pruneBoard(board: Board, cards: readonly CardEntry[], tags: readonly Tag[]): Board {
  const slugs = new Set(cards.map((card) => slugify(card.name)));
  const tagIds = new Set(tags.map((tag) => tag.id));
  return {
    sections: board.sections.map(({ tag, ...section }) => ({
      ...section,
      cards: [...new Set(section.cards)].filter((slug) => slugs.has(slug)),
      ...(tag !== undefined && tagIds.has(tag) ? { tag } : {}),
    })),
  };
}

function mapSection(board: Board, id: string, change: (section: Section) => Section): Board {
  const sections = board.sections.map((section) => (section.id === id ? change(section) : section));
  return sections.every((section, index) => section === board.sections[index])
    ? board
    : { sections };
}

export function addSection(board: Board, section: Section): Board {
  return { sections: [...board.sections, section] };
}

export function restoreSection(board: Board, section: Section, index: number): Board {
  if (board.sections.some((other) => other.id === section.id)) {
    return board;
  }
  const sections = [...board.sections];
  sections.splice(index, 0, section);
  return { sections };
}

export function removeSection(board: Board, id: string): Board {
  return { sections: board.sections.filter((section) => section.id !== id) };
}

export function changeSection(
  board: Board,
  id: string,
  change: Partial<Pick<Section, "label" | "tag">>,
): Board {
  return mapSection(board, id, (section) =>
    (Object.keys(change) as (keyof typeof change)[]).every((key) => section[key] === change[key])
      ? section
      : { ...section, ...change },
  );
}

export function putCard(board: Board, id: string, slug: string): Board {
  return mapSection(board, id, (section) =>
    section.cards.includes(slug) ? section : { ...section, cards: [...section.cards, slug] },
  );
}

export function takeCard(board: Board, id: string, slug: string): Board {
  return mapSection(board, id, (section) =>
    section.cards.includes(slug)
      ? { ...section, cards: section.cards.filter((card) => card !== slug) }
      : section,
  );
}

export function moveCard(board: Board, from: string, to: string, slug: string): Board {
  return from === to ? board : putCard(takeCard(board, from, slug), to, slug);
}
