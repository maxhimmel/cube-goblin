import type { GroupRow, StatCard } from "@repo/cube/browser";
import type { CubeRef } from "@repo/server/events";

export const OUTLIER = 0.05;
export const PERCENT = 100;
export const MAX_AXES = 8;
export const MIN_AXES = 3;
export const DEFAULT_PINS = 5;
const CUBE_HUE_COUNT = 6;

export interface Column {
  cube: CubeRef;
  cards: StatCard[];
  open: boolean;
}

export function hueOf(index: number): string {
  return `var(--cube-${String((index % CUBE_HUE_COUNT) + 1)})`;
}

export function percent(share: number): string {
  return `${String(Math.round(share * PERCENT))}%`;
}

export function gapLabel(delta: number): string {
  const rounded = Math.round(Math.abs(delta) * PERCENT);
  return `${delta > 0 ? "+" : "−"}${String(rounded)}`;
}

export function spread(row: GroupRow): number {
  return Math.max(0, ...row.cells.map((cell) => Math.abs(cell.delta)));
}

export function isEmpty(row: GroupRow): boolean {
  return row.cells.every((cell) => cell.count === 0);
}

export function gapCount(rows: readonly GroupRow[]): number {
  return rows.filter((row) => spread(row) >= OUTLIER).length;
}

export function radarIds(ids: readonly string[], rowOf: ReadonlyMap<string, GroupRow>): string[] {
  const live = ids.filter((id) => {
    const row = rowOf.get(id);
    return row !== undefined && !isEmpty(row);
  });
  if (live.length <= MAX_AXES) {
    return live;
  }
  const kept = new Set(
    live.toSorted((a, b) => spreadOf(b, rowOf) - spreadOf(a, rowOf)).slice(0, MAX_AXES),
  );
  return live.filter((id) => kept.has(id));
}

function spreadOf(id: string, rowOf: ReadonlyMap<string, GroupRow>): number {
  const row = rowOf.get(id);
  return row ? spread(row) : 0;
}

export function byGap(ids: readonly string[], rowOf: ReadonlyMap<string, GroupRow>): string[] {
  const rank = new Map([...rowOf.keys()].map((id, index) => [id, index]));
  return ids.toSorted(
    (a, b) =>
      spreadOf(b, rowOf) - spreadOf(a, rowOf) ||
      (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity),
  );
}

export function defaultPins(rowOf: ReadonlyMap<string, GroupRow>): string[] {
  return [...rowOf.values()]
    .filter((row) => !isEmpty(row))
    .toSorted((a, b) => spread(b) - spread(a))
    .slice(0, DEFAULT_PINS)
    .map((row) => row.id);
}
