import type { CardStatus, Filter, Spread } from "@repo/cube/browser";
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
  creatureBalance,
  scaled,
  size,
  statTest,
} from "@repo/cube/browser";
import type { Against } from "./compare.ts";
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
  if (kind === "pt" || kind === "body") {
    return `${first}/${second}`;
  }
  if (kind === "creatureCurve") {
    return `Creatures · MV ${label(first)}`;
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
  ref?: number | undefined;
}

export interface RefView {
  scope: readonly GridCard[];
  lens: Test | undefined;
  against: Against | undefined;
}

function refCount(count: number, view: RefView, against: Against): number {
  return against.unit === "share" ? scaled(count, against.cards.length, view.scope.length) : count;
}

export function refOf(id: string, view: RefView): number | undefined {
  const { against, lens } = view;
  const test = statTest(id);
  if (!against || !test) {
    return undefined;
  }
  const count = against.cards.filter((card) => test(card) && (lens ? lens(card) : true)).length;
  return refCount(count, view, against);
}

export function withRefs<T extends Tally>(rows: readonly T[], view: RefView): T[] {
  return view.against ? rows.map((row) => ({ ...row, ref: refOf(row.id, view) })) : [...rows];
}

export function heatRefs(rows: readonly HeatRow[], view: RefView): HeatRow[] {
  return rows.map((row) => ({ ...row, cells: withRefs(row.cells, view) }));
}

export function balanceRefs(rows: readonly BalanceRow[], view: RefView): BalanceRow[] {
  const { against } = view;
  if (!against) {
    return [...rows];
  }
  const ranges = new Map(creatureBalance(against.cards).curve.map((row) => [row.id, row.size]));
  return rows.map((row) => ({
    ...row,
    tally: { ...row.tally, ref: refOf(row.tally.id, view) },
    refRange: ranges.get(row.tally.id.split(":").at(-1) ?? ""),
  }));
}

export function matchupRefs(data: Matchups, view: RefView): Matchups {
  const { against, lens } = view;
  if (!against) {
    return data;
  }
  const theirs = matchups(against.cards, against.cards, lens).corners;
  return {
    ...data,
    corners: data.corners.map((corner) => {
      const found = theirs.find((other) => other.id === corner.id);
      return { ...corner, ref: found && refCount(found.hit, view, against) };
    }),
  };
}

export function refLabel(ref: number): string {
  return ref >= 10 || Number.isInteger(ref) ? String(Math.round(ref)) : ref.toFixed(1);
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

export function scaleTop(rows: readonly Tally[], toBase: boolean): number {
  return Math.max(
    1,
    ...rows.map((row) =>
      Math.max(
        row.hit,
        row.hit + row.ghost,
        toBase ? Math.max(row.base, row.base + row.baseGhost) : 0,
        row.ref ?? 0,
      ),
    ),
  );
}

export function ghostLabel(delta: number): string {
  return delta > 0 ? `+${String(delta)}` : String(delta);
}

export type DotState = "hit" | "faint" | "arriving" | "leaving";

function dotState(
  card: GridCard,
  now: ReadonlySet<string>,
  later: ReadonlySet<string>,
  lens: Test | undefined,
): DotState {
  if (!now.has(card.slug)) {
    return "arriving";
  }
  if (!later.has(card.slug)) {
    return "leaving";
  }
  return lens && !lens(card) ? "faint" : "hit";
}

export interface BalanceDot {
  card: GridCard;
  power: number;
  toughness: number;
  size: number;
  place: "above" | "within" | "below";
  state: DotState;
}

export interface BalanceRow {
  tally: Tally;
  range: Spread | undefined;
  refRange?: Spread | undefined;
  dots: BalanceDot[];
}

function placeIn(total: number, range: Spread | undefined): BalanceDot["place"] {
  if (range === undefined || (total >= range.q1 && total <= range.q3)) {
    return "within";
  }
  return total > range.q3 ? "above" : "below";
}

export function balanceRows(
  scope: readonly GridCard[],
  next: readonly GridCard[],
  lens: Test | undefined,
): BalanceRow[] {
  const now = new Set(scope.map((card) => card.slug));
  const later = new Set(next.map((card) => card.slug));
  const ranges = new Map(creatureBalance(scope).curve.map((row) => [row.id, row.size]));
  const union = [...new Map([...scope, ...next].map((card) => [card.slug, card])).values()];
  const bodies = creatureBalance(union).bodies;
  return CURVE_COLUMNS.flatMap((column) => {
    const id = `creatureCurve:${column.id}`;
    const bucket = parseBucket(id);
    if (!bucket) {
      return [];
    }
    const row = tally(id, column.label, scope, next, (card) => inBucket(card, bucket), lens);
    const range = ranges.get(column.id);
    const dots = bodies
      .filter((entry) => curveKey(entry.card) === column.id)
      .map((entry) => ({
        card: entry.card,
        power: entry.power,
        toughness: entry.toughness,
        size: size(entry),
        place: placeIn(size(entry), range),
        state: dotState(entry.card, now, later, lens),
      }))
      .toSorted((a, b) => a.size - b.size || a.card.name.localeCompare(b.card.name));
    const empty = row.base === 0 && row.baseGhost === 0 && dots.length === 0;
    return empty ? [] : [{ tally: row, range, dots }];
  });
}

export const MATCHUP_CORNERS = [
  { id: "wins", title: "Wins most fights", kills: true, survives: true },
  { id: "wall", title: "Walls", kills: false, survives: true },
  { id: "cannon", title: "Glass cannons", kills: true, survives: false },
  { id: "chump", title: "Chump blockers", kills: false, survives: false },
] as const;

export type CornerId = (typeof MATCHUP_CORNERS)[number]["id"];

export interface MatchupDot {
  tally: Tally;
  power: number;
  toughness: number;
  kills: number;
  survives: number;
  corner: CornerId;
  names: string[];
  arriving: boolean;
  leaving: boolean;
}

export interface Matchups {
  dots: MatchupDot[];
  corners: (Tally & { corner: CornerId })[];
}

const HALF = 0.5;

function cornerOf(kills: number, survives: number): CornerId {
  const corner = MATCHUP_CORNERS.find(
    (entry) => entry.kills === kills >= HALF && entry.survives === survives >= HALF,
  );
  return corner?.id ?? "chump";
}

export function matchups(
  scope: readonly GridCard[],
  next: readonly GridCard[],
  lens: Test | undefined,
): Matchups {
  const opponents = creatureBalance(scope).bodies;
  const share = (test: (other: (typeof opponents)[number]) => boolean): number =>
    opponents.length === 0 ? 0 : opponents.filter(test).length / opponents.length;
  const union = [...new Map([...scope, ...next].map((card) => [card.slug, card])).values()];
  const groups = new Map<string, { power: number; toughness: number; names: string[] }>();
  for (const entry of creatureBalance(union).bodies) {
    const key = `body:${String(entry.power)}:${String(entry.toughness)}`;
    const group = groups.get(key) ?? { power: entry.power, toughness: entry.toughness, names: [] };
    groups.set(key, { ...group, names: [...group.names, entry.card.name] });
  }
  const dots = [...groups.entries()].flatMap(([id, group]) => {
    const bucket = parseBucket(id);
    if (!bucket) {
      return [];
    }
    const row = tally(
      id,
      `${String(group.power)}/${String(group.toughness)}`,
      scope,
      next,
      (card) => inBucket(card, bucket),
      lens,
    );
    const kills = share((other) => group.power >= other.toughness);
    const survives = share((other) => other.power < group.toughness);
    return [
      {
        tally: row,
        power: group.power,
        toughness: group.toughness,
        kills,
        survives,
        corner: cornerOf(kills, survives),
        names: group.names.toSorted((a, b) => a.localeCompare(b)),
        arriving: row.base === 0,
        leaving: row.base + row.baseGhost === 0,
      },
    ];
  });
  const corners = MATCHUP_CORNERS.map((corner) => {
    const here = dots.filter((dot) => dot.corner === corner.id).map((dot) => dot.tally);
    const sum = (pick: (row: Tally) => number): number =>
      here.reduce((total, row) => total + pick(row), 0);
    return {
      id: `corner:${corner.id}`,
      label: corner.title,
      corner: corner.id,
      base: sum((row) => row.base),
      hit: sum((row) => row.hit),
      ghost: sum((row) => row.ghost),
      baseGhost: sum((row) => row.baseGhost),
    };
  });
  return { dots, corners };
}
