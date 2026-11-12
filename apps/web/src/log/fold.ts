import type { Change, LogEntry } from "@repo/cube/browser";
import { sameValue } from "@repo/cube/browser";

export type LogRow =
  | { kind: "entry"; entry: LogEntry }
  | { kind: "fold"; id: string; entries: LogEntry[]; labels: string[] };

export const FOLD_GAP_MS = 30 * 60 * 1000;

const FOLD_REACH = 50;

interface Net {
  label: string;
  before: unknown;
  after: unknown;
}

type Touch = [key: string, label: string, before: unknown, after: unknown];

function touches<T>(
  prefix: string,
  changes: readonly Change<T>[],
  id: (item: T) => string,
  label: (item: T) => string,
): Touch[] {
  return changes.flatMap((change) => {
    const item = change.after ?? change.before;
    return item === undefined
      ? []
      : [[`${prefix}:${id(item)}`, label(item), change.before, change.after] as Touch];
  });
}

function touched(entry: LogEntry): Touch[] {
  const { cards, tags, sections, filters } = entry.changes;
  return [
    ...touches(
      "card",
      cards,
      (card) => card.oracleId,
      (card) => card.name,
    ),
    ...touches(
      "tag",
      tags,
      (tag) => tag.id,
      (tag) => tag.label,
    ),
    ...touches(
      "section",
      sections,
      (section) => section.id,
      (section) => section.label,
    ),
    ...touches(
      "filter",
      filters,
      (filter) => filter.id,
      (filter) => filter.label,
    ),
  ];
}

function cancelingEnd(entries: readonly LogEntry[], start: number): number | undefined {
  const net = new Map<string, Net>();
  const last = Math.min(entries.length, start + FOLD_REACH);
  for (let index = start; index < last; index += 1) {
    const entry = entries[index];
    if (entry === undefined) {
      break;
    }
    const previous = entries[index - 1];
    if (
      index > start &&
      previous !== undefined &&
      Date.parse(entry.at) - Date.parse(previous.at) > FOLD_GAP_MS
    ) {
      return undefined;
    }
    for (const [key, label, before, after] of touched(entry)) {
      const seen = net.get(key);
      net.set(key, { label, before: seen ? seen.before : before, after });
    }
    if (
      index > start &&
      net.size > 0 &&
      [...net.values()].every((item) => sameValue(item.before, item.after))
    ) {
      return index;
    }
  }
  return undefined;
}

function foldLabels(entries: readonly LogEntry[]): string[] {
  const labels: string[] = [];
  for (const entry of entries) {
    for (const [, label] of touched(entry)) {
      if (label !== "" && !labels.includes(label)) {
        labels.push(label);
      }
    }
  }
  return labels;
}

export function foldCanceled(entries: readonly LogEntry[]): LogRow[] {
  const rows: LogRow[] = [];
  let index = 0;
  while (index < entries.length) {
    const entry = entries[index];
    if (entry === undefined) {
      break;
    }
    const end = cancelingEnd(entries, index);
    if (end === undefined) {
      rows.push({ kind: "entry", entry });
      index += 1;
      continue;
    }
    const run = entries.slice(index, end + 1);
    rows.push({ kind: "fold", id: `fold-${entry.id}`, entries: run, labels: foldLabels(run) });
    index = end + 1;
  }
  return rows;
}

export function foldedIds(rows: readonly LogRow[]): Set<string> {
  return new Set(
    rows.flatMap((row) => (row.kind === "fold" ? row.entries.map((entry) => entry.id) : [])),
  );
}

export function rowMatches(row: LogRow, needle: string): boolean {
  const entries = row.kind === "fold" ? row.entries : [row.entry];
  return (
    needle === "" ||
    entries.some((entry) => entry.message.toLowerCase().includes(needle)) ||
    (row.kind === "fold" && row.labels.some((label) => label.toLowerCase().includes(needle)))
  );
}

export function foldSummary(row: Extract<LogRow, { kind: "fold" }>): string {
  const names = row.labels.slice(0, 3).join(", ");
  const more = row.labels.length > 3 ? ` and ${String(row.labels.length - 3)} more` : "";
  return `${String(row.entries.length)} edits that cancel out${names === "" ? "" : ` · ${names}${more}`}`;
}
