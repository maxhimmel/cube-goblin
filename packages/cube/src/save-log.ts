import type { LogEntry, LogMessage, LogSource, LogState, LogStats } from "./log.ts";
import { buildEntry, logChanges, mergeNotes, parseMessage } from "./log.ts";
import type { Conflict } from "./revert.ts";
import { describeConflicts, planRevert } from "./revert.ts";
import { z } from "zod";
import type { CubePaths } from "./store.ts";
import {
  appendLog,
  deleteCard,
  readBoard,
  readCards,
  readFilters,
  readLog,
  readTags,
  replaceLastLog,
  writeBoard,
  writeCard,
  writeFilters,
  writeTags,
} from "./store.ts";

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
  if (!entry) {
    return undefined;
  }
  const merged = mergeNotes((await readLog(paths)).at(-1), entry);
  if (merged.merge) {
    await replaceLastLog(paths, merged.entry);
    return merged.entry;
  }
  await appendLog(paths, entry);
  return entry;
}

export const revertRequestSchema = z.strictObject({
  ids: z.array(z.string()).min(1),
});

export type RevertResult =
  | { ok: true; entry: LogEntry }
  | { ok: false; status: 400 | 404; error: string }
  | { ok: false; status: 409; error: string; conflicts: Conflict[] };

function revertSubject(entries: readonly LogEntry[]): string {
  const [only] = entries;
  return entries.length === 1 && only
    ? `Revert "${parseMessage(only.message).subject}"`
    : `Revert ${String(entries.length)} entries`;
}

async function writeState(paths: CubePaths, from: LogState, to: LogState): Promise<void> {
  const changes = logChanges(from, to);
  for (const { before, after } of changes.cards) {
    if (after !== undefined) {
      await writeCard(paths, after);
    } else if (before !== undefined) {
      await deleteCard(paths, before);
    }
  }
  if (changes.tags.length > 0) {
    await writeTags(paths, to.tags);
  }
  if (changes.sections.length > 0) {
    await writeBoard(paths, to.board);
  }
  if (changes.filters.length > 0) {
    await writeFilters(paths, { filters: [...to.filters] });
  }
}

export async function revertEntries(
  paths: CubePaths,
  input: unknown,
  statsOf: StatsOf,
  message: LogMessage = {},
): Promise<RevertResult> {
  const parsed = revertRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  const log = await readLog(paths);
  const ids = [...new Set(parsed.data.ids)];
  const entries = ids.map((id) => log.find((entry) => entry.id === id));
  const missing = ids.filter((_, index) => entries[index] === undefined);
  if (missing.length > 0) {
    return { ok: false, status: 404, error: `No log entry ${missing.join(", ")}` };
  }
  const found = entries.filter((entry) => entry !== undefined);
  const current = await readLogState(paths);
  const plan = planRevert(current, found);
  if (!plan.ok) {
    const error = [
      ...(plan.conflicts.length > 0 ? [describeConflicts(plan.conflicts)] : []),
      ...plan.problems,
    ].join("\n");
    return plan.conflicts.length > 0
      ? { ok: false, status: 409, error, conflicts: plan.conflicts }
      : { ok: false, status: 400, error };
  }
  await writeState(paths, current, plan.state);
  const entry = await recordEdit(paths, current, statsOf, {
    message: { subject: message.subject ?? revertSubject(found), body: message.body },
    source: "revert",
    reverts: found.map((item) => item.id),
  });
  if (!entry) {
    return { ok: false, status: 400, error: "Nothing to revert" };
  }
  return { ok: true, entry };
}
