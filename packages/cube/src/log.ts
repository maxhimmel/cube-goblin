import { z } from "zod";
import type { Filter } from "./filters.ts";
import { filterSchema } from "./filters.ts";
import type { Board, CardEntry, Section, Tag } from "./schema.ts";
import { cardEntrySchema, sectionSchema, tagSchema } from "./schema.ts";
import type { StatCard } from "./stats.ts";
import { COLOR_GROUPS, CURVE_COLUMNS, TYPE_COLUMNS, cubeStats, isLand } from "./stats.ts";

export const LOG_SOURCES = ["workbench", "revert", "git"] as const;

function changeOf<S extends z.ZodType>(schema: S) {
  return z.strictObject({ before: schema.optional(), after: schema.optional() });
}

export const logStatsSchema = z.record(z.string(), z.number());

export const logChangesSchema = z.strictObject({
  cards: z.array(changeOf(cardEntrySchema)),
  tags: z.array(changeOf(tagSchema)),
  sections: z.array(changeOf(sectionSchema)),
  filters: z.array(changeOf(filterSchema)),
});

export const logEntrySchema = z.strictObject({
  id: z.string().regex(/^[0-9a-z-]+$/u),
  at: z.iso.datetime(),
  source: z.enum(LOG_SOURCES),
  message: z.string().min(1),
  reverts: z.array(z.string()).optional(),
  changes: logChangesSchema,
  stats: logStatsSchema,
});

export type LogSource = (typeof LOG_SOURCES)[number];
export type LogStats = z.infer<typeof logStatsSchema>;
export type LogChanges = z.infer<typeof logChangesSchema>;
export type LogEntry = z.infer<typeof logEntrySchema>;

export interface Change<T> {
  before?: T | undefined;
  after?: T | undefined;
}

export interface LogState {
  cards: readonly CardEntry[];
  tags: readonly Tag[];
  board: Board;
  filters: readonly Filter[];
}

export interface LogMessage {
  subject?: string | undefined;
  body?: string | undefined;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stable);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

function changesBy<T>(
  before: readonly T[],
  after: readonly T[],
  key: (item: T) => string,
): Change<T>[] {
  const old = new Map(before.map((item) => [key(item), item]));
  const next = new Map(after.map((item) => [key(item), item]));
  const keys = [...new Set([...old.keys(), ...next.keys()])];
  return keys.flatMap((id) => {
    const was = old.get(id);
    const is = next.get(id);
    if (sameValue(was, is)) {
      return [];
    }
    return [
      { ...(was === undefined ? {} : { before: was }), ...(is === undefined ? {} : { after: is }) },
    ];
  });
}

export function logChanges(before: LogState, after: LogState): LogChanges {
  return {
    cards: changesBy(before.cards, after.cards, (card) => card.oracleId),
    tags: changesBy(before.tags, after.tags, (tag) => tag.id),
    sections: changesBy<Section>(
      before.board.sections,
      after.board.sections,
      (section) => section.id,
    ),
    filters: changesBy(before.filters, after.filters, (filter) => filter.id),
  };
}

export function isEmptyChange(changes: LogChanges): boolean {
  return (
    changes.cards.length +
      changes.tags.length +
      changes.sections.length +
      changes.filters.length ===
    0
  );
}

const MV_DIGITS = 2;

export function logStats(cards: readonly StatCard[], vocabulary: readonly Tag[]): LogStats {
  const draft = cards.filter((card) => card.status === "draft");
  const all = cubeStats(cards, []);
  const stats = cubeStats(draft, vocabulary);
  const spells = draft.filter((card) => !isLand(card));
  const mv = spells.reduce((sum, card) => sum + card.cmc, 0) / Math.max(spells.length, 1);
  const out: LogStats = {};
  for (const status of all.status) {
    out[status.id] = status.count;
  }
  out["mv.avg"] = Number(mv.toFixed(MV_DIGITS));
  for (const column of CURVE_COLUMNS) {
    out[`mv.${column.label}`] = stats.curve.find((item) => item.id === column.id)?.count ?? 0;
  }
  for (const group of COLOR_GROUPS) {
    out[`color.${group.id}`] = stats.colors.find((item) => item.id === group.id)?.count ?? 0;
  }
  for (const column of TYPE_COLUMNS) {
    out[`type.${column.id}`] = stats.types.find((item) => item.id === column.id)?.count ?? 0;
  }
  for (const tag of stats.tags) {
    out[`tag.${tag.id}`] = tag.count;
  }
  return out;
}

export function statDeltas(before: LogStats, after: LogStats): [string, number, number][] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return keys.flatMap((key) => {
    const was = before[key] ?? 0;
    const is = after[key] ?? 0;
    return was === is ? [] : [[key, was, is] as [string, number, number]];
  });
}

function list(items: readonly string[]): string {
  return items.join(", ");
}

function added(before: readonly string[], after: readonly string[]): string[] {
  return after.filter((item) => !before.includes(item));
}

function cardTrailer({ before, after }: Change<CardEntry>): string {
  const card = after ?? before;
  const parts: string[] = [];
  if (before === undefined) {
    parts.push(`added as ${after?.status ?? ""}`);
  } else if (after === undefined) {
    parts.push("deleted");
  } else {
    if (before.name !== after.name) {
      parts.push(`renamed from ${before.name}`);
    }
    if (before.status !== after.status) {
      parts.push(`${before.status}→${after.status}`);
    }
    parts.push(...added(before.tags, after.tags).map((tag) => `+${tag}`));
    parts.push(...added(after.tags, before.tags).map((tag) => `-${tag}`));
    if (before.notes !== after.notes) {
      parts.push("notes");
    }
    if (before.printing !== after.printing) {
      parts.push("printing");
    }
  }
  return `Card: ${card?.name ?? ""} ${list(parts)}`;
}

function tagTrailer({ before, after }: Change<Tag>): string {
  const tag = after ?? before;
  if (before === undefined) {
    return `Tag: ${tag?.id ?? ""} added (${after?.kind ?? ""})`;
  }
  if (after === undefined) {
    return `Tag: ${before.id} removed`;
  }
  const parts: string[] = [];
  if (before.label !== after.label) {
    parts.push(`renamed ${before.label}→${after.label}`);
  }
  if (before.kind !== after.kind) {
    parts.push(`${before.kind}→${after.kind}`);
  }
  return `Tag: ${after.id} ${list(parts)}`;
}

function sectionTrailer({ before, after }: Change<Section>): string {
  const section = after ?? before;
  if (before === undefined) {
    return `Section: ${section?.label ?? ""} added`;
  }
  if (after === undefined) {
    return `Section: ${before.label} removed`;
  }
  const parts: string[] = [];
  if (before.label !== after.label) {
    parts.push(`renamed from ${before.label}`);
  }
  parts.push(...added(before.cards, after.cards).map((card) => `+${card}`));
  parts.push(...added(after.cards, before.cards).map((card) => `-${card}`));
  parts.push(...added(before.tags, after.tags).map((tag) => `+tag:${tag}`));
  parts.push(...added(after.tags, before.tags).map((tag) => `-tag:${tag}`));
  if (parts.length === 0) {
    parts.push("reordered");
  }
  return `Section: ${after.label} ${list(parts)}`;
}

function filterTrailer({ before, after }: Change<Filter>): string {
  const filter = after ?? before;
  if (before === undefined) {
    return `Filter: ${filter?.label ?? ""} added`;
  }
  if (after === undefined) {
    return `Filter: ${before.label} removed`;
  }
  const parts: string[] = [];
  if (before.label !== after.label) {
    parts.push(`renamed from ${before.label}`);
  }
  if (before.query !== after.query) {
    parts.push(`query ${after.query}`);
  }
  if (parts.length === 0) {
    parts.push("changed");
  }
  return `Filter: ${after.label} ${list(parts)}`;
}

function formatStat(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(MV_DIGITS);
}

export const STAT_GROUPS = [
  { prefix: "", trailer: "Counts" },
  { prefix: "mv.", trailer: "Curve" },
  { prefix: "color.", trailer: "Colors" },
  { prefix: "type.", trailer: "Types" },
  { prefix: "tag.", trailer: "Tags" },
] as const;

function statGroup(key: string): (typeof STAT_GROUPS)[number] {
  return (
    STAT_GROUPS.find((group) => group.prefix !== "" && key.startsWith(group.prefix)) ??
    STAT_GROUPS[0]
  );
}

export function statsTrailers(before: LogStats, after: LogStats): string[] {
  const deltas = statDeltas(before, after);
  return STAT_GROUPS.flatMap((group) => {
    const moved = deltas.filter(([key]) => statGroup(key) === group);
    if (moved.length === 0) {
      return [];
    }
    const parts = moved.map(
      ([key, was, is]) => `${key.slice(group.prefix.length)} ${formatStat(was)}→${formatStat(is)}`,
    );
    return [`${group.trailer}: ${list(parts)}`];
  });
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? "" : "s"}`;
}

function changeTrailers(changes: LogChanges): string[] {
  return [
    ...changes.cards.map(cardTrailer),
    ...changes.tags.map(tagTrailer),
    ...changes.sections.map(sectionTrailer),
    ...changes.filters.map(filterTrailer),
  ];
}

export function autoSubject(changes: LogChanges): string {
  const trailers = changeTrailers(changes);
  const [only] = trailers;
  if (trailers.length === 1 && only !== undefined) {
    return only.slice(only.indexOf(": ") + 2);
  }
  const parts = [
    changes.cards.length > 0 ? plural(changes.cards.length, "card") : "",
    changes.tags.length > 0 ? plural(changes.tags.length, "tag") : "",
    changes.sections.length > 0 ? plural(changes.sections.length, "section") : "",
    changes.filters.length > 0 ? plural(changes.filters.length, "filter") : "",
  ].filter((part) => part !== "");
  return `Changed ${list(parts)}`;
}

export function entryMessage(
  message: LogMessage,
  changes: LogChanges,
  before: LogStats,
  after: LogStats,
  reverts: readonly string[] = [],
): string {
  const written = message.subject?.trim() ?? "";
  const subject = written === "" ? autoSubject(changes) : written;
  const body = message.body?.trim() ?? "";
  const trailers = [
    ...changeTrailers(changes),
    ...statsTrailers(before, after),
    reverts.length > 0 ? `Reverts: ${list(reverts)}` : undefined,
  ].filter((line) => line !== undefined);
  return [subject, body, trailers.join("\n")].filter((part) => part !== "").join("\n\n");
}

export interface ParsedMessage {
  subject: string;
  body: string;
  trailers: [string, string][];
}

const TRAILER = /^([A-Z][A-Za-z-]*): (.*)$/u;

export function parseMessage(message: string): ParsedMessage {
  const paragraphs = message.split(/\n{2,}/u);
  const subject = paragraphs[0] ?? "";
  const last = paragraphs.length > 1 ? (paragraphs.at(-1) ?? "") : "";
  const lines = last.split("\n");
  const isTrailers = last !== "" && lines.every((line) => TRAILER.test(line));
  const trailers = isTrailers
    ? lines.map((line) => {
        const [, key = "", value = ""] = TRAILER.exec(line) ?? [];
        return [key, value] as [string, string];
      })
    : [];
  const body = paragraphs.slice(1, isTrailers ? -1 : undefined).join("\n\n");
  return { subject, body, trailers };
}

function entryId(at: Date): string {
  const stamp = at.toISOString().replace(/[-:.]/gu, "").toLowerCase();
  const random = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0");
  return `${stamp}-${random}`;
}

export interface NewEntry {
  before: LogState;
  after: LogState;
  statsBefore: LogStats;
  statsAfter: LogStats;
  message: LogMessage;
  source: LogSource;
  reverts?: readonly string[];
  at?: Date;
}

export function buildEntry(input: NewEntry): LogEntry | undefined {
  const changes = logChanges(input.before, input.after);
  if (isEmptyChange(changes)) {
    return undefined;
  }
  const at = input.at ?? new Date();
  const reverts = input.reverts ?? [];
  return {
    id: entryId(at),
    at: at.toISOString(),
    source: input.source,
    message: entryMessage(input.message, changes, input.statsBefore, input.statsAfter, reverts),
    ...(reverts.length > 0 ? { reverts: [...reverts] } : {}),
    changes,
    stats: input.statsAfter,
  };
}

export const NOTES_MERGE_MS = 10 * 60 * 1000;

function notesOnly(entry: LogEntry): Change<CardEntry> | undefined {
  const { cards, tags, sections, filters } = entry.changes;
  const [only] = cards;
  if (
    entry.source !== "workbench" ||
    cards.length !== 1 ||
    tags.length + sections.length + filters.length > 0 ||
    only?.before === undefined ||
    only.after === undefined
  ) {
    return undefined;
  }
  return sameValue({ ...only.before, notes: "" }, { ...only.after, notes: "" }) ? only : undefined;
}

export type Merge = { merge: false } | { merge: true; entry: LogEntry | undefined };

export function mergeNotes(previous: LogEntry | undefined, next: LogEntry): Merge {
  const was = previous && notesOnly(previous);
  const is = notesOnly(next);
  if (!previous || !was || !is || !sameValue(was.after, is.before)) {
    return { merge: false };
  }
  const old = parseMessage(previous.message);
  const now = parseMessage(next.message);
  if (
    old.subject !== now.subject ||
    old.body !== now.body ||
    Date.parse(next.at) - Date.parse(previous.at) > NOTES_MERGE_MS
  ) {
    return { merge: false };
  }
  if (sameValue(was.before, is.after)) {
    return { merge: true, entry: undefined };
  }
  const changes: LogChanges = {
    cards: [{ before: was.before, after: is.after }],
    tags: [],
    sections: [],
    filters: [],
  };
  return { merge: true, entry: { ...next, id: previous.id, at: previous.at, changes } };
}
