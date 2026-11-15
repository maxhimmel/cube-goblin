import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { BoardStatuses, CardStatus, CubePaths, ImportMatch, ImportRow } from "@repo/cube";
import {
  applyImport,
  createCubeFolder,
  cubeCobraId,
  fetchCubeCobra,
  isCubeCobraSource,
  parseList,
  planImport,
  readCards,
  readLogState,
  readTags,
  recordEdit,
  resolveRows,
  statusForBoard,
} from "@repo/cube";
import type { Card } from "@repo/scryfall";
import { ScryfallError } from "@repo/scryfall";
import { statsOf } from "@repo/server";
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

async function readSource(source: string): Promise<{ text: string; batch: string }> {
  const id = isCubeCobraSource(source) ? cubeCobraId(source) : undefined;
  if (id !== undefined) {
    return {
      text: await fetchCubeCobra(id, { userAgent: USER_AGENT }),
      batch: `cubecobra-${id}`,
    };
  }
  return { text: await readFile(source, "utf8"), batch: basename(source, extname(source)) };
}

function describe(row: ImportRow): string {
  return `line ${String(row.line)} "${row.name}"`;
}

export async function importList(
  target: CubePaths,
  source: string,
  options: ImportOptions,
): Promise<number> {
  const { text, batch } = await readSource(source);
  const parsed = parseList(text);
  console.log(chalk.dim(`${parsed.format}: ${String(parsed.rows.length)} rows`));
  const client = createClient();
  const { matches, misses } = await resolveRows<ImportRow, Card>(parsed.rows, {
    collection: (identifiers) => client.collection(identifiers),
    fuzzy: (name) =>
      client.named(name, { fuzzy: true }).catch((error: unknown) => {
        if (error instanceof ScryfallError && error.status === 404) {
          return undefined;
        }
        throw error;
      }),
  });

  const boards = new Map<string, number>();
  for (const row of parsed.rows) {
    boards.set(row.board, (boards.get(row.board) ?? 0) + 1);
  }
  for (const [board, count] of boards) {
    const status = statusForBoard(board, options.boards);
    console.log(`${board} (${String(count)}) -> ${status}`);
  }

  const paths =
    options.newCube === undefined || options.dryRun
      ? target
      : (await createCubeFolder(options.newCube, parsed.title ?? batch)).paths;
  const existing = options.newCube === undefined ? await readCards(paths) : [];
  const tags = options.newCube === undefined ? await readTags(paths) : [];
  const importMatches: ImportMatch[] = matches.flatMap(({ row, card, how }) => {
    if (card.oracle_id === undefined) {
      return [];
    }
    const pinned = how === "printing" || how === "mtgo" || how === "set-number";
    return [
      { row, oracleId: card.oracle_id, name: card.name, ...(pinned ? { printing: card.id } : {}) },
    ];
  });
  for (const { row, card, how } of matches) {
    if (how === "fuzzy") {
      console.log(
        `${chalk.yellow("~")} ${describe(row)} ${chalk.dim("->")} ${chalk.bold(card.name)}`,
      );
    }
  }
  const plan = planImport({
    matches: importMatches,
    existing,
    tags,
    batch,
    boards: options.boards,
  });
  for (const { row, message } of plan.warnings) {
    console.log(chalk.yellow(`warn: ${describe(row)}: ${message}`));
  }
  for (const { row, reason } of plan.skipped) {
    console.log(chalk.dim(`skip: ${describe(row)}: ${reason}`));
  }
  for (const { row, reason } of misses) {
    console.log(chalk.red(`miss: ${describe(row)}: ${reason}`));
  }
  const counts = { draft: 0, prospect: 0, cut: 0 };
  for (const card of plan.cards) {
    counts[card.status] += 1;
  }
  const summary = `${String(plan.cards.length)} cards (${String(counts.draft)} draft, ${String(counts.prospect)} prospect, ${String(counts.cut)} cut), ${String(plan.newTags.length)} new tags`;
  if (options.dryRun) {
    console.log(chalk.green(`Would import ${summary}`));
    return misses.length > 0 ? 1 : 0;
  }
  const before = await readLogState(paths);
  const result = await applyImport(paths, plan);
  if (!result.ok) {
    console.error(chalk.red(result.error));
    return 1;
  }
  await recordEdit(paths, before, statsOf(client), {
    message: { subject: `Import ${String(plan.cards.length)} cards from ${parsed.title ?? batch}` },
  });
  console.log(chalk.green(`Imported ${summary} into ${paths.root}`));
  return misses.length > 0 ? 1 : 0;
}
