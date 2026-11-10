import { validateBoard } from "./board.ts";
import type { Board } from "./schema.ts";
import { boardSchema } from "./schema.ts";
import type { CubePaths } from "./store.ts";
import { readCards, readTags, writeBoard } from "./store.ts";

export type BoardResult = { ok: true; board: Board } | { ok: false; status: 400; error: string };

export async function saveBoard(paths: CubePaths, input: unknown): Promise<BoardResult> {
  const parsed = boardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  const [cards, tags] = await Promise.all([readCards(paths), readTags(paths)]);
  const problems = validateBoard(parsed.data, cards, tags);
  if (problems.length > 0) {
    return { ok: false, status: 400, error: problems.join("\n") };
  }
  await writeBoard(paths, parsed.data);
  return { ok: true, board: parsed.data };
}
