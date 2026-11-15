import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { BoardStatuses, CardStatus, CubePaths } from "@repo/cube";
import {
  applyImport,
  createCubeFolder,
  isCubeCobraSource,
  readCards,
  readLogState,
  readTags,
  recordEdit,
} from "@repo/cube";
import type { SourceText } from "@repo/server";
import { prepareImport, readImportSource, statsOf } from "@repo/server";
import { chalk } from "zx";
import { USER_AGENT, createClient } from "../client.ts";

export interface ImportOptions {
  dryRun: boolean;
  newCube?: string;
  boards: BoardStatuses;
}

const STATUSES = new Set<string>(["draft", "prospect", "cut", "skip"]);

export function parseBoardOptions(values: readonly string[]): BoardStatuses | string {
  const boards: Record<string, CardStatus | "skip"> = {};
  for (const value of values) {
    const [board, status] = value.split("=");
    if (board === undefined || status === undefined || !STATUSES.has(status)) {
      return `--board wants <board>=<draft|prospect|cut|skip>, got "${value}"`;
    }
    boards[board.toLowerCase()] = status as CardStatus | "skip";
  }
  return boards;
}

async function readSource(source: string): Promise<SourceText> {
  if (isCubeCobraSource(source)) {
    return readImportSource({ url: source }, { userAgent: USER_AGENT });
  }
  return { text: await readFile(source, "utf8"), batch: basename(source, extname(source)) };
}

function at(entry: { line: number; name: string }): string {
  return `line ${String(entry.line)} "${entry.name}"`;
}

export async function importList(
  target: CubePaths,
  source: string,
  options: ImportOptions,
): Promise<number> {
  const text = await readSource(source);
  const fresh = options.newCube !== undefined;
  const client = createClient();
  const { plan, preview } = await prepareImport(client, text, {
    existing: fresh ? [] : await readCards(target),
    tags: fresh ? [] : await readTags(target),
    boards: options.boards,
    edits: {},
  });
  console.log(
    chalk.dim(
      `${preview.format}: ${String(preview.boards.reduce((sum, board) => sum + board.count, 0))} rows`,
    ),
  );
  for (const { board, count, status } of preview.boards) {
    console.log(`${board} (${String(count)}) -> ${status}`);
  }
  for (const entry of preview.added.filter((added) => added.how === "fuzzy")) {
    console.log(`${chalk.yellow("~")} ${at(entry)} ${chalk.dim("->")} ${chalk.bold(entry.card)}`);
  }
  for (const entry of preview.warnings) {
    console.log(chalk.yellow(`warn: ${at(entry)}: ${entry.message}`));
  }
  for (const entry of preview.skipped) {
    console.log(chalk.dim(`skip: ${at(entry)}: ${entry.reason}`));
  }
  for (const entry of preview.misses) {
    console.log(chalk.red(`miss: ${at(entry)}: ${entry.reason}`));
  }
  const counts = { draft: 0, prospect: 0, cut: 0 };
  for (const card of plan.cards) {
    counts[card.status] += 1;
  }
  const summary = `${String(plan.cards.length)} cards (${String(counts.draft)} draft, ${String(counts.prospect)} prospect, ${String(counts.cut)} cut), ${String(plan.newTags.length)} new tags`;
  const failed = preview.misses.length > 0 ? 1 : 0;
  if (options.dryRun) {
    console.log(chalk.green(`Would import ${summary}`));
    return failed;
  }
  const title = preview.title ?? text.batch;
  const paths =
    options.newCube === undefined ? target : (await createCubeFolder(options.newCube, title)).paths;
  const before = await readLogState(paths);
  const result = await applyImport(paths, plan);
  if (!result.ok) {
    console.error(chalk.red(result.error));
    return 1;
  }
  await recordEdit(paths, before, statsOf(client), {
    message: { subject: `Import ${String(plan.cards.length)} cards from ${title}` },
  });
  console.log(chalk.green(`Imported ${summary} into ${paths.root}`));
  return failed;
}
