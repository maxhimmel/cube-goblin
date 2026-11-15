import type { CubePaths } from "@repo/cube";
import {
  readBoard,
  readCards,
  readConfig,
  readFilters,
  readLayouts,
  readTags,
  readVersionFiles,
  validateBoard,
  validateCube,
  validateFilters,
  versionProblems,
} from "@repo/cube";
import { chalk } from "zx";

export async function validate(paths: CubePaths): Promise<number> {
  const [cards, tags, config, board, versions, filters, layouts] = await Promise.all([
    readCards(paths),
    readTags(paths),
    readConfig(paths),
    readBoard(paths).catch((error: unknown) => new Error(String(error))),
    readVersionFiles(paths),
    readFilters(paths).catch((error: unknown) => new Error(String(error))),
    readLayouts(paths).catch((error: unknown) => new Error(String(error))),
  ]);
  const problems = [
    ...validateCube(cards, tags),
    ...(board instanceof Error ? [board.message] : validateBoard(board, cards, tags)),
    ...versionProblems(versions),
    ...(filters instanceof Error ? [filters.message] : validateFilters(filters, tags)),
    ...(layouts instanceof Error ? [layouts.message] : []),
  ];
  for (const problem of problems) {
    console.error(chalk.red(problem));
  }
  const drafts = cards.filter((card) => card.status === "draft").length;
  const { min, max } = config.size;
  const sizeNote =
    drafts < min || drafts > max
      ? chalk.yellow(`draft is ${String(drafts)}, target ${String(min)}-${String(max)}`)
      : chalk.green(`draft is ${String(drafts)}, within ${String(min)}-${String(max)}`);
  console.log(`${String(cards.length)} cards valid. ${sizeNote}`);
  return problems.length > 0 ? 1 : 0;
}
