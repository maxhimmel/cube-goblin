import { pruneBoard, validateBoard } from "./board.ts";
import type { Board } from "./schema.ts";
import { boardSchema } from "./schema.ts";
import type { CubePaths } from "./store.ts";
import { readBoard, readCards, readTags, writeBoard } from "./store.ts";

export type BoardResult = { ok: true; board: Board } | { ok: false; status: 400; error: string };

export async function saveBoard(paths: CubePaths, input: unknown): Promise<BoardResult> {
  const parsed = boardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  const [cards, tags] = await Promise.all([readCards(paths), readTags(paths)]);
  const board = pruneBoard(parsed.data, cards, tags);
  const problems = validateBoard(board, cards, tags);
  if (problems.length > 0) {
    return { ok: false, status: 400, error: problems.join("\n") };
  }
  await writeBoard(paths, board);
  return { ok: true, board };
}

export async function loadBoard(paths: CubePaths): Promise<Board> {
  const [board, cards, tags] = await Promise.all([
    readBoard(paths),
    readCards(paths),
    readTags(paths),
  ]);
  return pruneBoard(board, cards, tags);
}
