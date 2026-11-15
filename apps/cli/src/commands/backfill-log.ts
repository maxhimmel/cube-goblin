import type { CubePaths } from "@repo/cube";
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
import type { Shell } from "zx";
import { $, chalk } from "zx";
import { createClient } from "../client.ts";

interface Checkout {
  state: LogState;
  logged: string[];
}

const EMPTY: Checkout = {
  state: { cards: [], tags: [], board: EMPTY_BOARD, filters: [] },
  logged: [],
};

interface Repo {
  git: Shell;
  prefix: string;
}

async function repoOf(cubeDir: string): Promise<Repo | undefined> {
  const found = await $({
    cwd: cubeDir,
    quiet: true,
  })`git rev-parse --show-toplevel --show-prefix`.nothrow();
  if (found.exitCode !== 0) {
    return undefined;
  }
  const [top = cubeDir, prefix = ""] = found.stdout.split("\n").map((line) => line.trim());
  return { git: $({ cwd: top, quiet: true }), prefix: prefix === "" ? "." : prefix };
}

async function checkout({ git, prefix }: Repo, sha: string): Promise<Checkout> {
  const hasCube = await git`git cat-file -e ${`${sha}:${prefix === "." ? "" : prefix}`}`.nothrow();
  if (hasCube.exitCode !== 0) {
    return EMPTY;
  }
  const dir = await mkdtemp(join(tmpdir(), "cube-backfill-"));
  try {
    await git`git archive ${sha} ${prefix} | tar -x -C ${dir}`;
    const paths = cubePaths(join(dir, prefix));
    await migrateLegacyCube(paths);
    const [state, log] = await Promise.all([readLogState(paths), readLog(paths)]);
    return { state, logged: log.map((entry) => entry.id) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function parentOf({ git }: Repo, sha: string): Promise<string | undefined> {
  const parent = await git`git rev-parse --verify --quiet ${`${sha}^`}`.nothrow();
  return parent.exitCode === 0 ? parent.stdout.trim() : undefined;
}

async function cubeCommits(repo: Repo): Promise<Commit[]> {
  const out =
    await repo.git`git log --reverse --topo-order --no-merges --format=%H%x1f%aI%x1f%B%x1e -- ${repo.prefix}`;
  const records = out.stdout
    .split("\x1e")
    .map((record) => record.trim())
    .filter((record) => record !== "");
  const states = new Map<string, Promise<Checkout>>();
  const cached = (sha: string | undefined): Promise<Checkout> => {
    if (sha === undefined) {
      return Promise.resolve(EMPTY);
    }
    const known = states.get(sha) ?? checkout(repo, sha);
    states.set(sha, known);
    return known;
  };
  const commits: Commit[] = [];
  for (const record of records) {
    const [sha = "", at = "", message = ""] = record.split("\x1f");
    process.stderr.write(`\rReading ${String(commits.length + 1)}/${String(records.length)}`);
    const [before, after] = await Promise.all([cached(await parentOf(repo, sha)), cached(sha)]);
    commits.push({
      sha,
      at,
      message,
      before: before.state,
      after: after.state,
      logged: after.logged,
    });
  }
  process.stderr.write("\n");
  return commits;
}

export async function backfillLog(paths: CubePaths, dryRun: boolean): Promise<number> {
  const repo = await repoOf(paths.root);
  if (repo === undefined) {
    console.log(chalk.yellow(`${paths.root} is not in a git repo; nothing to backfill.`));
    return 0;
  }
  const [commits, log] = await Promise.all([cubeCommits(repo), readLog(paths)]);
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
  await writeLog(paths, result.log);
  console.log(
    chalk.green(`Backfilled ${String(result.added.length)} entries into ${paths.logFile}`),
  );
  return 0;
}
