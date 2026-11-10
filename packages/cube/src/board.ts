import type { Bin, Board, CardEntry, Tag } from "./schema.ts";
import { slugify } from "./slug.ts";

export const EMPTY_BOARD: Board = { bins: [] };

export function validateBoard(
  board: Board,
  cards: readonly CardEntry[],
  tags: readonly Tag[],
): string[] {
  const problems: string[] = [];
  const slugs = new Set(cards.map((card) => slugify(card.name)));
  const tagIds = new Set(tags.map((tag) => tag.id));
  const binIds = new Set<string>();
  for (const bin of board.bins) {
    if (binIds.has(bin.id)) {
      problems.push(`Duplicate bin "${bin.id}" in board.json`);
    }
    binIds.add(bin.id);
    for (const slug of bin.cards) {
      if (!slugs.has(slug)) {
        problems.push(`Bin "${bin.label}" holds "${slug}", which is not in cube/cards`);
      }
    }
    if (new Set(bin.cards).size !== bin.cards.length) {
      problems.push(`Bin "${bin.label}" lists a card more than once`);
    }
    if (bin.tag !== undefined && !tagIds.has(bin.tag)) {
      problems.push(`Bin "${bin.label}" links tag "${bin.tag}", which is not in tags.json`);
    }
  }
  return problems;
}

export function pruneBoard(board: Board, cards: readonly CardEntry[], tags: readonly Tag[]): Board {
  const slugs = new Set(cards.map((card) => slugify(card.name)));
  const tagIds = new Set(tags.map((tag) => tag.id));
  return {
    bins: board.bins.map(({ tag, ...bin }) => ({
      ...bin,
      cards: [...new Set(bin.cards)].filter((slug) => slugs.has(slug)),
      ...(tag !== undefined && tagIds.has(tag) ? { tag } : {}),
    })),
  };
}

function mapBin(board: Board, id: string, change: (bin: Bin) => Bin): Board {
  const bins = board.bins.map((bin) => (bin.id === id ? change(bin) : bin));
  return bins.every((bin, index) => bin === board.bins[index]) ? board : { bins };
}

export function addBin(board: Board, bin: Bin): Board {
  return { bins: [...board.bins, bin] };
}

export function restoreBin(board: Board, bin: Bin, index: number): Board {
  if (board.bins.some((other) => other.id === bin.id)) {
    return board;
  }
  const bins = [...board.bins];
  bins.splice(index, 0, bin);
  return { bins };
}

export function removeBin(board: Board, id: string): Board {
  return { bins: board.bins.filter((bin) => bin.id !== id) };
}

export function changeBin(
  board: Board,
  id: string,
  change: Partial<Pick<Bin, "label" | "tag">>,
): Board {
  return mapBin(board, id, (bin) =>
    (Object.keys(change) as (keyof typeof change)[]).every((key) => bin[key] === change[key])
      ? bin
      : { ...bin, ...change },
  );
}

export function putCard(board: Board, id: string, slug: string): Board {
  return mapBin(board, id, (bin) =>
    bin.cards.includes(slug) ? bin : { ...bin, cards: [...bin.cards, slug] },
  );
}

export function takeCard(board: Board, id: string, slug: string): Board {
  return mapBin(board, id, (bin) =>
    bin.cards.includes(slug) ? { ...bin, cards: bin.cards.filter((card) => card !== slug) } : bin,
  );
}

export function moveCard(board: Board, from: string, to: string, slug: string): Board {
  return from === to ? board : putCard(takeCard(board, from, slug), to, slug);
}
