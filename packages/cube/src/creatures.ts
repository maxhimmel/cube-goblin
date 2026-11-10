import type { StatCard } from "./stats.ts";
import { CURVE_COLUMNS, curveKey, isCreature } from "./stats.ts";

export interface Body<T> {
  card: T;
  power: number;
  toughness: number;
}

export interface CurveBodies<T> {
  id: string;
  label: string;
  count: number;
  power: number | undefined;
  toughness: number | undefined;
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

function mean(values: readonly number[]): number | undefined {
  return values.length === 0 ? undefined : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function size(entry: Body<StatCard>): number {
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
    power: mean(bodies.map((entry) => entry.power)),
    toughness: mean(bodies.map((entry) => entry.toughness)),
    perMana: mean(paid.map((entry) => size(entry) / entry.card.cmc)),
    ...extremes(bodies),
    curve: CURVE_COLUMNS.map(({ id, label }) => {
      const here = bodies.filter((entry) => curveKey(entry.card) === id);
      return {
        id,
        label,
        count: creatures.filter((card) => curveKey(card) === id).length,
        power: mean(here.map((entry) => entry.power)),
        toughness: mean(here.map((entry) => entry.toughness)),
        ...extremes(here),
      };
    }),
  };
}
