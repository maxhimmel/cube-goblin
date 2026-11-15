import { boardStatus } from "./formats/types.ts";
import type { Board, ImportRow } from "./formats/types.ts";
import { FUNCTION_TAGS } from "./functions.ts";
import type { CardEntry, CardStatus, Tag } from "./schema.ts";
import { slugify } from "./slug.ts";
import type { CubePaths } from "./store.ts";
import { readCards, readTags, writeCard, writeTags } from "./store.ts";
import { sameLabel } from "./tags.ts";
import { validateCube } from "./validate.ts";

export interface ImportMatch {
  row: ImportRow;
  oracleId: string;
  name: string;
  printing?: string;
  functionTags?: readonly string[];
}

export type BoardStatuses = Readonly<Record<string, CardStatus | "skip">>;

export interface ImportPlan {
  cards: CardEntry[];
  newTags: Tag[];
  skipped: { row: ImportRow; reason: string }[];
  warnings: { row: ImportRow; message: string }[];
}

export interface PlanInput {
  matches: readonly ImportMatch[];
  existing: readonly CardEntry[];
  tags: readonly Tag[];
  batch: string;
  boards?: BoardStatuses;
}

export function statusForBoard(board: Board, boards: BoardStatuses = {}): CardStatus | "skip" {
  return boards[board] ?? boardStatus(board);
}

export function planImport(input: PlanInput): ImportPlan {
  const vocabulary = [...input.tags];
  const newTags: Tag[] = [];
  const tagId = (label: string): string | undefined => {
    const id = slugify(label);
    if (id === "") {
      return undefined;
    }
    const known = vocabulary.find((tag) => tag.id === id || sameLabel(tag.label, label));
    if (known !== undefined) {
      return known.id;
    }
    const tag: Tag = { id, label: label.trim() };
    vocabulary.push(tag);
    newTags.push(tag);
    return id;
  };
  const functionTagId = (id: string): string | undefined => {
    if (vocabulary.some((tag) => tag.id === id)) {
      return id;
    }
    const known = FUNCTION_TAGS.find((tag) => tag.id === id);
    if (known === undefined) {
      return undefined;
    }
    vocabulary.push(known);
    newTags.push(known);
    return id;
  };
  const inCube = new Map(input.existing.map((card) => [card.oracleId, card]));
  const taken = new Map<string, ImportMatch>();
  const plan: ImportPlan = { cards: [], newTags, skipped: [], warnings: [] };
  for (const match of input.matches) {
    const { row } = match;
    const status = statusForBoard(row.board, input.boards);
    if (status === "skip") {
      plan.skipped.push({ row, reason: `${row.board} is skipped` });
      continue;
    }
    const already = inCube.get(match.oracleId);
    if (already !== undefined) {
      plan.skipped.push({ row, reason: `${already.name} is already in the cube` });
      continue;
    }
    const earlier = taken.get(match.oracleId);
    if (earlier !== undefined) {
      plan.skipped.push({
        row,
        reason: `${match.name} is already on line ${String(earlier.row.line)}`,
      });
      continue;
    }
    taken.set(match.oracleId, match);
    if (row.quantity > 1) {
      plan.warnings.push({
        row,
        message: `${String(row.quantity)} copies of ${match.name}; a cube is singleton, so 1 is kept`,
      });
    }
    const tags = [
      ...new Set([
        ...row.tags.flatMap((label) => tagId(label) ?? []),
        ...(match.functionTags ?? []).flatMap((id) => functionTagId(id) ?? []),
      ]),
    ];
    const card: CardEntry = {
      name: match.name,
      oracleId: match.oracleId,
      status,
      tags,
      notes: row.notes,
      source: { batch: input.batch, line: row.line, input: row.input.trim() || match.name },
    };
    if (match.printing !== undefined) {
      card.printing = match.printing;
    }
    plan.cards.push(card);
  }
  return plan;
}

export type ApplyResult = { ok: true; added: number } | { ok: false; error: string };

export async function applyImport(paths: CubePaths, plan: ImportPlan): Promise<ApplyResult> {
  const [cards, tags] = await Promise.all([readCards(paths), readTags(paths)]);
  const nextTags = [
    ...tags,
    ...plan.newTags.filter((tag) => !tags.some((known) => known.id === tag.id)),
  ];
  const problems = validateCube([...cards, ...plan.cards], nextTags);
  if (problems.length > 0) {
    return { ok: false, error: problems.join("\n") };
  }
  if (nextTags.length !== tags.length) {
    await writeTags(paths, nextTags);
  }
  for (const card of plan.cards) {
    await writeCard(paths, card);
  }
  return { ok: true, added: plan.cards.length };
}
