import type { CardStatus, Filter } from "@repo/cube/browser";
import {
  COLOR_GROUPS,
  CURVE_COLUMNS,
  PT_VALUES,
  TYPE_COLUMNS,
  colorGroup,
  curveKey,
  inBucket,
  isLand,
  compileQuery,
  filterTest,
  parseBucket,
  bucketQuery,
  joinQuery,
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
  if (kind === "pt") {
    return `${first}/${second}`;
  }
  if (kind === "presence") {
    return first === "multicolored" ? "Multicolored" : `Has ${COLOR_LABEL.get(first) ?? first}`;
  }
  if (kind === "heavy") {
    return `Heavy ${COLOR_LABEL.get(first) ?? first}`;
  }
  if (kind === "type") {
    return TYPE_COLUMNS.find((column) => column.id === first)?.label ?? first;
  }
  return id;
}

const OR_PREFIX = "or:";

export function pillMembers(key: string): string[] {
  return key.startsWith(OR_PREFIX) ? key.slice(OR_PREFIX.length).split("|") : [key];
}

function bucketKind(key: string): string | undefined {
  const [first = ""] = pillMembers(key);
  return first.startsWith("x:") || first.startsWith("f:") ? undefined : parseBucket(first)?.kind;
}

export function pickKeys(keys: readonly string[], key: string): string[] {
  const kind = bucketKind(key);
  const at = kind === undefined ? -1 : keys.findIndex((other) => bucketKind(other) === kind);
  const group = keys[at];
  if (group === undefined) {
    return keys.includes(key) ? keys.filter((other) => other !== key) : [...keys, key];
  }
  const members = pillMembers(group);
  const next = members.includes(key)
    ? members.filter((member) => member !== key)
    : [...members, key];
  const [only] = next;
  if (only === undefined) {
    return keys.filter((_, index) => index !== at);
  }
  const merged = next.length === 1 ? only : `${OR_PREFIX}${next.join("|")}`;
  return keys.map((other, index) => (index === at ? merged : other));
}

export function peekKeys(keys: readonly string[], key: string): string[] {
  const kind = bucketKind(key);
  if (kind === undefined) {
    return keys.includes(key) ? [...keys] : [...keys, key];
  }
  const applied = keys.some((other) => pillMembers(other).includes(key));
  return applied ? [...keys] : pickKeys(keys, key);
}

export function resolvePill(key: string, filters: readonly Filter[]): Pill | undefined {
  if (key.startsWith(OR_PREFIX)) {
    const parts = pillMembers(key).flatMap((member) => resolvePill(member, filters) ?? []);
    return parts.length === 0
      ? undefined
      : {
          key,
          label: parts.map((part) => part.label).join(" or "),
          test: (card) => parts.some((part) => part.test(card)),
        };
  }
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
  const bucket = parseBucket(key);
  return bucket && { key, label: bucketLabel(key), test: (card) => inBucket(card, bucket) };
}

export function pillQuery(key: string, filters: readonly Filter[]): string | undefined {
  if (key.startsWith(OR_PREFIX)) {
    const parts = pillMembers(key).flatMap((member) => pillQuery(member, filters) ?? []);
    return parts.length < 2 ? parts[0] : `(${parts.map((part) => `(${part})`).join(" or ")})`;
  }
  if (key.startsWith("x:")) {
    return key.slice(2);
  }
  if (key.startsWith("f:")) {
    return filters.find((candidate) => candidate.id === key.slice(2))?.query;
  }
  const bucket = parseBucket(key);
  return bucket && bucketQuery(bucket);
}

export function stackQuery(keys: readonly string[], filters: readonly Filter[]): string {
  return joinQuery(...keys.map((key) => pillQuery(key, filters) ?? ""));
}

export function allOf(tests: readonly Test[]): Test | undefined {
  return tests.length === 0 ? undefined : (card) => tests.every((test) => test(card));
}

export function project(cards: readonly GridCard[], moves: readonly Drag[]): GridCard[] {
  const to = new Map(moves.flatMap((move) => (move.to ? [[move.slug, move.to] as const] : [])));
  return cards.map((card) => {
    const status = to.get(card.slug);
    return status === undefined ? card : { ...card, status };
  });
}

export interface Tally {
  id: string;
  label: string;
  base: number;
  hit: number;
  ghost: number;
  baseGhost: number;
}

export function tally(
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

export function bucketTallies(
  rows: readonly { id: string; label: string }[],
  scope: readonly GridCard[],
  next: readonly GridCard[],
  lens: Test | undefined,
): Tally[] {
  return rows.flatMap((row) => {
    const bucket = parseBucket(row.id);
    return bucket
      ? [tally(row.id, row.label, scope, next, (card) => inBucket(card, bucket), lens)]
      : [];
  });
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

export function ghostLabel(delta: number): string {
  return delta > 0 ? `+${String(delta)}` : String(delta);
}
