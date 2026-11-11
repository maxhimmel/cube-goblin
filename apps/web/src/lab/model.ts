import type { CardStatus, Filter } from "@repo/cube/browser";
import {
  COLORS,
  COLOR_GROUPS,
  CURVE_COLUMNS,
  PT_VALUES,
  colorGroup,
  curveKey,
  inBucket,
  isLand,
  compileQuery,
  filterTest,
  parseBucket,
} from "@repo/cube/browser";
import type { GridCard } from "../modes/mode.ts";

export type Test = (card: GridCard) => boolean;

export interface Pill {
  key: string;
  label: string;
  test: Test;
}

export interface Drag {
  slug: string;
  to?: CardStatus | undefined;
}

const COLOR_LABEL = new Map(COLOR_GROUPS.map((group) => [group.id, group.label]));

export function ptCell(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const top = Number(PT_VALUES.at(-2)?.id ?? "6");
  return /^\d+$/u.test(value) ? String(Math.min(Number(value), top)) : "*";
}

export function isCreatureCard(card: GridCard): boolean {
  return /\bCreature\b/u.test(card.typeLine.split("//")[0] ?? "") && card.power !== undefined;
}

function bucketLabel(id: string): string {
  const [kind, first = "", second = ""] = id.split(":");
  const label = (id: string): string =>
    CURVE_COLUMNS.find((column) => column.id === id)?.label ?? id;
  if (kind === "curve") {
    return `MV ${label(first)}`;
  }
  if (kind === "colorCurve") {
    return `${COLOR_LABEL.get(first) ?? first} · MV ${label(second)}`;
  }
  if (kind === "color") {
    return COLOR_LABEL.get(first) ?? first;
  }
  if (kind === "tag") {
    return `#${first}`;
  }
  return id;
}

export function resolvePill(key: string, filters: readonly Filter[]): Pill | undefined {
  if (key.startsWith("x:")) {
    const result = compileQuery(key.slice(2));
    return result.ok ? { key, label: key.slice(2), test: result.test } : undefined;
  }
  if (key.startsWith("f:")) {
    const filter = filters.find((candidate) => candidate.id === key.slice(2));
    return (
      filter && {
        key,
        label: filter.label,
        test: filterTest(filter),
      }
    );
  }
  if (key.startsWith("pt:")) {
    const [, power, toughness] = key.split(":");
    return {
      key,
      label: `${power ?? ""}/${toughness ?? ""}`,
      test: (card) =>
        isCreatureCard(card) &&
        ptCell(card.power) === power &&
        ptCell(card.toughness) === toughness,
    };
  }
  const bucket = parseBucket(key);
  return bucket && { key, label: bucketLabel(key), test: (card) => inBucket(card, bucket) };
}

export function allOf(tests: readonly Test[]): Test | undefined {
  return tests.length === 0 ? undefined : (card) => tests.every((test) => test(card));
}

export function project(cards: readonly GridCard[], drag: Drag | undefined): GridCard[] {
  if (!drag?.to) {
    return [...cards];
  }
  const to = drag.to;
  return cards.map((card) => (card.slug === drag.slug ? { ...card, status: to } : card));
}

export interface Tally {
  id: string;
  label: string;
  base: number;
  hit: number;
  ghost: number;
  baseGhost: number;
}

function tally(
  id: string,
  label: string,
  scope: readonly GridCard[],
  next: readonly GridCard[],
  inside: Test,
  lens: Test | undefined,
): Tally {
  const pass = (card: GridCard): boolean => inside(card) && (lens ? lens(card) : true);
  const hit = scope.filter(pass).length;
  const base = scope.filter(inside).length;
  return {
    id,
    label,
    base,
    hit,
    ghost: next.filter(pass).length - hit,
    baseGhost: next.filter(inside).length - base,
  };
}

export function curveTallies(
  scope: readonly GridCard[],
  next: readonly GridCard[],
  lens: Test | undefined,
): Tally[] {
  return CURVE_COLUMNS.map((column) =>
    tally(
      `curve:${column.id}`,
      column.label,
      scope,
      next,
      (card) => !isLand(card) && curveKey(card) === column.id,
      lens,
    ),
  );
}

export interface HeatRow {
  id: string;
  label: string;
  cells: Tally[];
}

export function heatRows(
  scope: readonly GridCard[],
  next: readonly GridCard[],
  lens: Test | undefined,
): HeatRow[] {
  return COLOR_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    cells: CURVE_COLUMNS.map((column) =>
      tally(
        `colorCurve:${group.id}:${column.id}`,
        column.label,
        scope,
        next,
        (card) => !isLand(card) && colorGroup(card) === group.id && curveKey(card) === column.id,
        lens,
      ),
    ),
  }));
}

export const PT_AXIS = PT_VALUES.map((value) => value.id);

export interface Used {
  curve: Set<string>;
  colors: Set<string>;
  power: Set<string>;
  toughness: Set<string>;
}

export function usedIn(cards: readonly GridCard[]): Used {
  const spells = cards.filter((card) => !isLand(card));
  const creatures = cards.filter(isCreatureCard);
  return {
    curve: new Set(spells.map(curveKey)),
    colors: new Set(spells.map(colorGroup)),
    power: new Set(creatures.flatMap((card) => ptCell(card.power) ?? [])),
    toughness: new Set(creatures.flatMap((card) => ptCell(card.toughness) ?? [])),
  };
}

export const MANA_COLORS = COLORS.map((color) => color.id);

export function ghostLabel(delta: number): string {
  return delta > 0 ? `+${String(delta)}` : String(delta);
}
