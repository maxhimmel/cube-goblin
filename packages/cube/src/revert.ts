import { validateBoard } from "./board.ts";
import { validateFilters } from "./filters.ts";
import type { Change, LogEntry, LogState } from "./log.ts";
import { sameValue } from "./log.ts";
import { validateCube } from "./validate.ts";

export interface Conflict {
  entry: string;
  kind: "card" | "tag" | "section" | "filter";
  name: string;
}

export type RevertPlan =
  { ok: true; state: LogState } | { ok: false; conflicts: Conflict[]; problems: string[] };

function undo<T>(
  items: readonly T[],
  changes: readonly Change<T>[],
  key: (item: T) => string,
  conflict: (item: T) => void,
): T[] {
  let next = [...items];
  for (const change of [...changes].reverse()) {
    const item = change.after ?? change.before;
    if (item === undefined) {
      continue;
    }
    const id = key(item);
    const index = next.findIndex((current) => key(current) === id);
    const current = index === -1 ? undefined : next[index];
    if (!sameValue(current, change.after)) {
      conflict(item);
      continue;
    }
    if (change.before === undefined) {
      next = next.filter((_, at) => at !== index);
    } else if (index === -1) {
      next.push(change.before);
    } else {
      next[index] = change.before;
    }
  }
  return next;
}

export function planRevert(state: LogState, entries: readonly LogEntry[]): RevertPlan {
  const conflicts: Conflict[] = [];
  let next: LogState = state;
  const newestFirst = [...entries].sort((a, b) => b.at.localeCompare(a.at));
  for (const entry of newestFirst) {
    const flag = (kind: Conflict["kind"], name: string): void => {
      conflicts.push({ entry: entry.id, kind, name });
    };
    next = {
      cards: undo(
        next.cards,
        entry.changes.cards,
        (card) => card.oracleId,
        (card) => {
          flag("card", card.name);
        },
      ),
      tags: undo(
        next.tags,
        entry.changes.tags,
        (tag) => tag.id,
        (tag) => {
          flag("tag", tag.label);
        },
      ),
      board: {
        sections: undo(
          next.board.sections,
          entry.changes.sections,
          (section) => section.id,
          (section) => {
            flag("section", section.label);
          },
        ),
      },
      filters: undo(
        next.filters,
        entry.changes.filters,
        (filter) => filter.id,
        (filter) => {
          flag("filter", filter.label);
        },
      ),
    };
  }
  const problems = [
    ...validateCube(next.cards, next.tags),
    ...validateBoard(next.board, next.cards, next.tags),
    ...validateFilters({ filters: [...next.filters] }, next.tags),
  ];
  if (conflicts.length > 0 || problems.length > 0) {
    return { ok: false, conflicts, problems };
  }
  return { ok: true, state: next };
}

export function describeConflicts(conflicts: readonly Conflict[]): string {
  const names = [...new Set(conflicts.map((conflict) => `${conflict.kind} ${conflict.name}`))];
  return `Changed since: ${names.join(", ")}`;
}
