import type { StatCard } from "./stats.ts";
import { CURVE_COLUMNS, curveKey, isCreature } from "./stats.ts";

export interface Body<T> {
  card: T;
  power: number;
  toughness: number;
}

export interface Spread {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export interface CurveBodies<T> {
  id: string;
  label: string;
  count: number;
  power: number | undefined;
  toughness: number | undefined;
  size: Spread | undefined;
  smallest: Body<T> | undefined;
  biggest: Body<T> | undefined;
}

export interface CreatureBalance<T> {
  creatures: number;
  variable: number;
  power: number | undefined;
  toughness: number | undefined;
  perMana: number | undefined;
  biggest: Body<T> | undefined;
  smallest: Body<T> | undefined;
  strongest: Body<T> | undefined;
  toughest: Body<T> | undefined;
  bodies: Body<T>[];
  curve: CurveBodies<T>[];
}

function fixed(value: string | undefined): number | undefined {
  return value !== undefined && /^\d+$/u.test(value) ? Number(value) : undefined;
}

export function body<T extends StatCard>(card: T): Body<T> | undefined {
  if (!isCreature(card)) {
    return undefined;
  }
  const power = fixed(card.power);
  const toughness = fixed(card.toughness);
  if (power === undefined || toughness === undefined || power + toughness === 0) {
    return undefined;
  }
  return { card, power, toughness };
}

export function quantile(sorted: readonly number[], q: number): number {
  const at = (sorted.length - 1) * q;
  const low = sorted[Math.floor(at)] ?? 0;
  const high = sorted[Math.ceil(at)] ?? low;
  return low + (high - low) * (at - Math.floor(at));
}

export function median(values: readonly number[]): number | undefined {
  return values.length === 0
    ? undefined
    : quantile(
        [...values].sort((a, b) => a - b),
        0.5,
      );
}

export function spread(values: readonly number[]): Spread | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return {
    min: sorted[0] ?? 0,
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted.at(-1) ?? 0,
  };
}

export function isOutlier(value: number, range: Spread): boolean {
  const reach = 1.5 * (range.q3 - range.q1);
  return value < range.q1 - reach || value > range.q3 + reach;
}

export function size(entry: Body<StatCard>): number {
  return entry.power + entry.toughness;
}

function bigger(a: Body<StatCard>, b: Body<StatCard>): number {
  return size(a) - size(b) || a.power - b.power || b.card.cmc - a.card.cmc;
}

function extremes<T extends StatCard>(
  bodies: readonly Body<T>[],
): Pick<CreatureBalance<T>, "biggest" | "smallest"> {
  const sorted = [...bodies].sort(bigger);
  return { smallest: sorted[0], biggest: sorted.at(-1) };
}

export function creatureBalance<T extends StatCard>(cards: readonly T[]): CreatureBalance<T> {
  const creatures = cards.filter(isCreature);
  const bodies = cards.flatMap((card) => body(card) ?? []);
  const paid = bodies.filter((entry) => entry.card.cmc > 0);
  return {
    creatures: creatures.length,
    variable: creatures.length - bodies.length,
    power: median(bodies.map((entry) => entry.power)),
    toughness: median(bodies.map((entry) => entry.toughness)),
    perMana: median(paid.map((entry) => size(entry) / entry.card.cmc)),
    ...extremes(bodies),
    strongest: [...bodies].sort((a, b) => b.power - a.power || b.toughness - a.toughness)[0],
    toughest: [...bodies].sort((a, b) => b.toughness - a.toughness || b.power - a.power)[0],
    bodies,
    curve: CURVE_COLUMNS.map(({ id, label }) => {
      const here = bodies.filter((entry) => curveKey(entry.card) === id);
      return {
        id,
        label,
        count: creatures.filter((card) => curveKey(card) === id).length,
        power: median(here.map((entry) => entry.power)),
        toughness: median(here.map((entry) => entry.toughness)),
        size: spread(here.map(size)),
        ...extremes(here),
      };
    }),
  };
}

export interface Matchup<T> {
  power: number;
  toughness: number;
  bodies: Body<T>[];
  kills: number;
  survives: number;
}

export function combatMatchups<T extends StatCard>(bodies: readonly Body<T>[]): Matchup<T>[] {
  const groups = new Map<string, Body<T>[]>();
  for (const entry of bodies) {
    const key = `${String(entry.power)}/${String(entry.toughness)}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  const share = (test: (other: Body<T>) => boolean): number =>
    bodies.length === 0 ? 0 : bodies.filter(test).length / bodies.length;
  return [...groups.values()].flatMap((group) => {
    const first = group[0];
    if (!first) {
      return [];
    }
    return [
      {
        power: first.power,
        toughness: first.toughness,
        bodies: group,
        kills: share((other) => first.power >= other.toughness),
        survives: share((other) => other.power < first.toughness),
      },
    ];
  });
}
