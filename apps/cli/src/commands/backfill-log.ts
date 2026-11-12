import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Commit, LogState } from "@repo/cube";
import {
  EMPTY_BOARD,
  backfill,
  cubePaths,
  migrateLegacyCube,
  parseMessage,
  readLog,
  readLogState,
  stateStats,
  writeLog,
} from "@repo/cube";
import { displayFields } from "@repo/scryfall";
import { $, chalk } from "zx";
import { createClient } from "../client.ts";
import { CUBE_PATHS, REPO_ROOT } from "../paths.ts";

const EMPTY_STATE: LogState = { cards: [], tags: [], board: EMPTY_BOARD, filters: [] };

const git = $({ cwd: REPO_ROOT, quiet: true });

async function stateAt(sha: string): Promise<LogState> {
  const hasCube = await git`git cat-file -e ${`${sha}:cube`}`.nothrow();
  if (hasCube.exitCode !== 0) {
    return EMPTY_STATE;
  }
  const dir = await mkdtemp(join(tmpdir(), "cube-backfill-"));
  try {
    await git`git archive ${sha} cube | tar -x -C ${dir}`;
    const paths = cubePaths(dir);
    await migrateLegacyCube(paths);
    return await readLogState(paths);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function parentOf(sha: string): Promise<string | undefined> {
  const parent = await git`git rev-parse --verify --quiet ${`${sha}^`}`.nothrow();
  return parent.exitCode === 0 ? parent.stdout.trim() : undefined;
}

async function cubeCommits(): Promise<Commit[]> {
  const out =
    await git`git log --reverse --topo-order --no-merges --format=%H%x1f%aI%x1f%B%x1e -- cube/`;
  const records = out.stdout
    .split("\x1e")
    .map((record) => record.trim())
    .filter((record) => record !== "");
  const states = new Map<string, Promise<LogState>>();
  const cached = (sha: string | undefined): Promise<LogState> => {
    if (sha === undefined) {
      return Promise.resolve(EMPTY_STATE);
    }
    const known = states.get(sha) ?? stateAt(sha);
    states.set(sha, known);
    return known;
  };
  const commits: Commit[] = [];
  for (const record of records) {
    const [sha = "", at = "", message = ""] = record.split("\x1f");
    process.stderr.write(`\rReading ${String(commits.length + 1)}/${String(records.length)}`);
    const [before, after] = await Promise.all([cached(await parentOf(sha)), cached(sha)]);
    commits.push({ sha, at, message, before, after });
  }
  process.stderr.write("\n");
  return commits;
}

export async function backfillLog(dryRun: boolean): Promise<number> {
  const [commits, log] = await Promise.all([cubeCommits(), readLog(CUBE_PATHS)]);
  const oracleIds = new Set(
    commits.flatMap((commit) =>
      [...commit.before.cards, ...commit.after.cards].map((card) => card.oracleId),
    ),
  );
  const { cards, missing } = await createClient().byOracleIds([...oracleIds]);
  if (missing.length > 0) {
    console.error(chalk.red(`Scryfall could not find: ${missing.join(", ")}`));
    return 1;
  }
  const byOracle = new Map(cards.map((card) => [card.oracle_id, card]));
  const result = await backfill(commits, log, (state) =>
    Promise.resolve(
      stateStats(state, (oracleId) => {
        const card = byOracle.get(oracleId);
        return card ? displayFields(card) : undefined;
      }),
    ),
  );
  for (const entry of result.added) {
    console.log(`${entry.at.slice(0, 16)}  ${parseMessage(entry.message).subject}`);
  }
  if (result.added.length === 0) {
    console.log(chalk.green("Log already holds every cube commit."));
    return 0;
  }
  if (dryRun) {
    console.log(chalk.yellow(`Dry run: ${String(result.added.length)} entries not written.`));
    return 0;
  }
  await writeLog(CUBE_PATHS, result.log);
  console.log(
    chalk.green(`Backfilled ${String(result.added.length)} entries into ${CUBE_PATHS.logFile}`),
  );
  return 0;
}
