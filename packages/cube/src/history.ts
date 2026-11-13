import { CURRENT } from "./diff.ts";
import type { LogEntry, LogState } from "./log.ts";
import type { RevertPlan } from "./revert.ts";
import { planRevert } from "./revert.ts";

export const POINT_SIDES = ["before", "after"] as const;

export type PointSide = (typeof POINT_SIDES)[number];

export type Point =
  | { kind: "current" }
  | { kind: "version"; id: string }
  | { kind: "entry"; side: PointSide; entry: string };

export function entryPoint(side: PointSide, entry: string): string {
  return `${side}:${entry}`;
}

export function parsePoint(id: string): Point {
  if (id === CURRENT) {
    return { kind: "current" };
  }
  const [side, entry] = id.split(":", 2);
  if (entry !== undefined && POINT_SIDES.some((known) => known === side)) {
    return { kind: "entry", side: side as PointSide, entry };
  }
  return { kind: "version", id };
}

export function stateAtEntry(
  state: LogState,
  log: readonly LogEntry[],
  side: PointSide,
  entry: string,
): RevertPlan | undefined {
  const index = log.findIndex((item) => item.id === entry);
  if (index === -1) {
    return undefined;
  }
  return planRevert(state, log.slice(side === "after" ? index + 1 : index));
}
