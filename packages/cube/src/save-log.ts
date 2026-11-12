import type { LogEntry, LogMessage, LogSource, LogState, LogStats } from "./log.ts";
import { buildEntry } from "./log.ts";
import type { CubePaths } from "./store.ts";
import { appendLog, readBoard, readCards, readFilters, readTags } from "./store.ts";

export type StatsOf = (state: LogState) => Promise<LogStats>;

export async function readLogState(paths: CubePaths): Promise<LogState> {
  const [cards, tags, board, filters] = await Promise.all([
    readCards(paths),
    readTags(paths),
    readBoard(paths),
    readFilters(paths),
  ]);
  return { cards, tags, board, filters: filters.filters };
}

export interface RecordOptions {
  message?: LogMessage;
  source?: LogSource;
  reverts?: readonly string[];
  at?: Date;
}

export async function recordEdit(
  paths: CubePaths,
  before: LogState,
  statsOf: StatsOf,
  options: RecordOptions = {},
): Promise<LogEntry | undefined> {
  const after = await readLogState(paths);
  const [statsBefore, statsAfter] = await Promise.all([statsOf(before), statsOf(after)]);
  const entry = buildEntry({
    before,
    after,
    statsBefore,
    statsAfter,
    message: options.message ?? {},
    source: options.source ?? "workbench",
    ...(options.reverts === undefined ? {} : { reverts: options.reverts }),
    ...(options.at === undefined ? {} : { at: options.at }),
  });
  if (entry) {
    await appendLog(paths, entry);
  }
  return entry;
}
