import type { LogEntry } from "@repo/cube/browser";
import { STAT_GROUPS, parseMessage } from "@repo/cube/browser";

export type StatGroupName = (typeof STAT_GROUPS)[number]["trailer"];

export interface StatOption {
  key: string;
  label: string;
}

export interface TimelinePoint {
  id: string;
  entry: string;
  index: number;
  key: string;
  label: string;
  value: number;
  subject: string;
  why: boolean;
  at: string;
}

export const DEFAULT_STATS: readonly string[] = ["draft"];

export function statGroupOf(key: string): StatGroupName {
  return (
    STAT_GROUPS.find((group) => group.prefix !== "" && key.startsWith(group.prefix)) ??
    STAT_GROUPS[0]
  ).trailer;
}

export function statLabel(key: string): string {
  const group = STAT_GROUPS.find((item) => item.prefix !== "" && key.startsWith(item.prefix));
  const rest = group ? key.slice(group.prefix.length) : key;
  return rest === "avg" ? "average" : rest;
}

export function statOptions(entries: readonly LogEntry[]): Map<StatGroupName, StatOption[]> {
  const keys: string[] = [];
  for (const entry of entries) {
    for (const key of Object.keys(entry.stats)) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }
  return new Map(
    STAT_GROUPS.map((group) => [
      group.trailer,
      keys
        .filter((key) => statGroupOf(key) === group.trailer)
        .map((key) => ({ key, label: statLabel(key) })),
    ]),
  );
}

export function hasWhy(entry: LogEntry): boolean {
  return parseMessage(entry.message).body !== "";
}

export function timelinePoints(
  entries: readonly LogEntry[],
  keys: readonly string[],
): TimelinePoint[] {
  return entries.flatMap((entry, index) => {
    const message = parseMessage(entry.message);
    return keys.map((key) => ({
      id: `${entry.id}:${key}`,
      entry: entry.id,
      index,
      key,
      label: statLabel(key),
      value: entry.stats[key] ?? 0,
      subject: message.subject,
      why: message.body !== "",
      at: entry.at,
    }));
  });
}

export function toggleStat(keys: readonly string[], key: string): string[] {
  return keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key];
}

const MANA: Record<string, string> = {
  "color.W": "var(--mana-w)",
  "color.U": "var(--mana-u)",
  "color.B": "var(--mana-b)",
  "color.R": "var(--mana-r)",
  "color.G": "var(--mana-g)",
  "color.multicolored": "var(--mana-m)",
  "color.colorless": "var(--mana-c)",
};

const PALETTE = [
  "var(--chart-curve)",
  "var(--chart-functions)",
  "var(--chart-types)",
  "var(--chart-status)",
  "var(--chart-group)",
  "var(--chart-archetype)",
];

export function statColor(key: string, keys: readonly string[]): string {
  const mana = MANA[key];
  if (mana !== undefined) {
    return mana;
  }
  const others = keys.filter((item) => MANA[item] === undefined);
  return PALETTE[Math.max(0, others.indexOf(key)) % PALETTE.length] ?? "var(--chart-curve)";
}
