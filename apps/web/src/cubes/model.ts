import type { GroupRow, StatCard } from "@repo/cube/browser";
import type { CubeRef } from "@repo/server/events";
import type { StatRow } from "./rows.tsx";

export const OUTLIER = 0.05;
export const PERCENT = 100;
export const MAX_AXES = 8;
export const MIN_AXES = 3;
export const DEFAULT_PINS = 5;
const CUBE_HUE_COUNT = 6;
const TELLS = 2;

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

export function defaultPins(rowOf: ReadonlyMap<string, GroupRow>): string[] {
  return [...rowOf.values()]
    .filter((row) => !isEmpty(row))
    .toSorted((a, b) => spread(b) - spread(a))
    .slice(0, DEFAULT_PINS)
    .map((row) => row.id);
}

export interface Tell {
  cube: number;
  nouns: string[];
}

export function tells(
  columns: readonly Column[],
  rowOf: ReadonlyMap<string, GroupRow>,
  specs: ReadonlyMap<string, StatRow>,
): Tell[] {
  return columns.map((_, cube) => ({
    cube,
    nouns: [...rowOf.values()]
      .flatMap((row) => {
        const delta = row.cells[cube]?.delta ?? 0;
        const noun = specs.get(row.id)?.noun;
        return delta >= OUTLIER && noun !== undefined ? [{ noun, delta }] : [];
      })
      .toSorted((a, b) => b.delta - a.delta)
      .slice(0, TELLS)
      .map((entry) => entry.noun),
  }));
}

export interface Biggest {
  cube: number;
  id: string;
  share: number;
  delta: number;
}

export function biggestGap(rowOf: ReadonlyMap<string, GroupRow>): Biggest | undefined {
  let best: Biggest | undefined;
  for (const row of rowOf.values()) {
    row.cells.forEach((cell, cube) => {
      if (best === undefined || Math.abs(cell.delta) > Math.abs(best.delta)) {
        best = { cube, id: row.id, share: cell.share, delta: cell.delta };
      }
    });
  }
  return best && Math.abs(best.delta) >= OUTLIER ? best : undefined;
}
