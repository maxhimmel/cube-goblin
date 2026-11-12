import type { Change, LogChanges, LogEntry, LogMessage, LogState } from "./log.ts";
import {
  entryId,
  entryMessage,
  isEmptyChange,
  logChanges,
  parseMessage,
  sameValue,
} from "./log.ts";
import type { StatsOf } from "./save-log.ts";

export interface Commit {
  sha: string;
  at: string;
  message: string;
  before: LogState;
  after: LogState;
  logged: readonly string[];
}

export interface Backfill {
  log: LogEntry[];
  added: LogEntry[];
}

const SOURCE_TRAILER = "Source";
const CONVENTIONAL = /^[a-z]+(?:\([^)]*\))?!?: /u;

export function gitSha(entry: LogEntry): string | undefined {
  if (entry.source !== "git") {
    return undefined;
  }
  const trailer = parseMessage(entry.message).trailers.find(
    ([key, value]) => key === SOURCE_TRAILER && value.startsWith("git "),
  );
  return trailer?.[1].slice("git ".length);
}

export function commitMessage(raw: string): LogMessage {
  const { subject, body } = parseMessage(raw.trim());
  const bare = subject.replace(CONVENTIONAL, "");
  return { subject: bare.charAt(0).toUpperCase() + bare.slice(1), body };
}

function unlogged<T>(changes: Change<T>[], logged: readonly Change<T>[]): Change<T>[] {
  return changes.filter(
    (change) =>
      !logged.some(
        (other) => sameValue(other.before, change.before) && sameValue(other.after, change.after),
      ),
  );
}

export function withoutLogged(changes: LogChanges, logged: readonly LogEntry[]): LogChanges {
  return {
    cards: unlogged(
      changes.cards,
      logged.flatMap((entry) => entry.changes.cards),
    ),
    tags: unlogged(
      changes.tags,
      logged.flatMap((entry) => entry.changes.tags),
    ),
    sections: unlogged(
      changes.sections,
      logged.flatMap((entry) => entry.changes.sections),
    ),
    filters: unlogged(
      changes.filters,
      logged.flatMap((entry) => entry.changes.filters),
    ),
  };
}

async function rebuild(
  commit: Commit,
  committed: readonly LogEntry[],
  statsOf: StatsOf,
): Promise<LogEntry | undefined> {
  const changes = withoutLogged(logChanges(commit.before, commit.after), committed);
  if (isEmptyChange(changes)) {
    return undefined;
  }
  const [statsBefore, statsAfter] = await Promise.all([
    statsOf(commit.before),
    statsOf(commit.after),
  ]);
  const at = new Date(commit.at);
  const message = entryMessage(commitMessage(commit.message), changes, statsBefore, statsAfter);
  return {
    id: entryId(at),
    at: at.toISOString(),
    source: "git",
    message: `${message}\n${SOURCE_TRAILER}: git ${commit.sha}`,
    changes,
    stats: statsAfter,
  };
}

export async function backfill(
  commits: readonly Commit[],
  log: readonly LogEntry[],
  statsOf: StatsOf,
): Promise<Backfill> {
  const rebuilt = new Map(
    log.flatMap((entry) => {
      const sha = gitSha(entry);
      return sha === undefined ? [] : [[sha, entry] as const];
    }),
  );
  const live = log.filter((entry) => gitSha(entry) === undefined);
  const walked = new Set(commits.map((commit) => commit.sha));
  const git = log.filter((entry) => {
    const sha = gitSha(entry);
    return sha !== undefined && !walked.has(sha);
  });
  const added: LogEntry[] = [];
  const emitted = new Set<string>();
  const ordered: LogEntry[] = [...git];
  for (const commit of commits) {
    const inCommit = new Set(commit.logged);
    const fresh = live.filter((entry) => inCommit.has(entry.id) && !emitted.has(entry.id));
    const existing = rebuilt.get(commit.sha);
    const entry = existing ?? (await rebuild(commit, fresh, statsOf));
    if (entry) {
      ordered.push(entry);
      if (!existing) {
        added.push(entry);
      }
    }
    for (const item of fresh) {
      emitted.add(item.id);
      ordered.push(item);
    }
  }
  return { log: [...ordered, ...live.filter((entry) => !emitted.has(entry.id))], added };
}
