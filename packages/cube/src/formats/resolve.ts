import { nameCandidates, normalizeName } from "./names.ts";

export interface ResolvableRow {
  name: string;
  set?: string;
  collectorNumber?: string;
  printingId?: string;
  mtgoId?: number;
}

export interface ResolvableCard {
  id: string;
  name: string;
  set: string;
  collector_number: string;
  mtgo_id?: number | undefined;
  card_faces?: readonly { name: string }[] | undefined;
}

export type Identifier =
  | { id: string }
  | { mtgo_id: number }
  | { set: string; collector_number: string }
  | { name: string };

export interface Resolver<C extends ResolvableCard> {
  collection: (identifiers: readonly Identifier[]) => Promise<{ cards: C[] }>;
  fuzzy?: (name: string) => Promise<C | undefined>;
}

export type MatchHow = "printing" | "mtgo" | "set-number" | "name" | "fuzzy";

export interface Match<R, C> {
  row: R;
  card: C;
  how: MatchHow;
}

export interface Miss<R> {
  row: R;
  reason: string;
}

interface Step<R, C> {
  how: MatchHow;
  requests: (row: R) => Identifier[];
  rowKeys: (row: R) => string[];
  cardKeys: (card: C) => string[];
}

const setNumber = (set: string, number: string) => `${set.toLowerCase()}|${number.toLowerCase()}`;

function steps<R extends ResolvableRow, C extends ResolvableCard>(): Step<R, C>[] {
  return [
    {
      how: "printing",
      requests: (row) => (row.printingId === undefined ? [] : [{ id: row.printingId }]),
      rowKeys: (row) => (row.printingId === undefined ? [] : [row.printingId]),
      cardKeys: (card) => [card.id],
    },
    {
      how: "mtgo",
      requests: (row) => (row.mtgoId === undefined ? [] : [{ mtgo_id: row.mtgoId }]),
      rowKeys: (row) => (row.mtgoId === undefined ? [] : [String(row.mtgoId)]),
      cardKeys: (card) => (card.mtgo_id === undefined ? [] : [String(card.mtgo_id)]),
    },
    {
      how: "set-number",
      requests: (row) =>
        row.set === undefined || row.collectorNumber === undefined
          ? []
          : [{ set: row.set, collector_number: row.collectorNumber }],
      rowKeys: (row) =>
        row.set === undefined || row.collectorNumber === undefined
          ? []
          : [setNumber(row.set, row.collectorNumber)],
      cardKeys: (card) => [setNumber(card.set, card.collector_number)],
    },
    {
      how: "name",
      requests: (row) => nameCandidates(row.name).map((name) => ({ name })),
      rowKeys: (row) => nameCandidates(row.name).map(normalizeName),
      cardKeys: (card) =>
        [card.name, ...(card.card_faces ?? []).map((face) => face.name)].map(normalizeName),
    },
  ];
}

export async function resolveRows<R extends ResolvableRow, C extends ResolvableCard>(
  rows: readonly R[],
  resolver: Resolver<C>,
): Promise<{ matches: Match<R, C>[]; misses: Miss<R>[] }> {
  const found = new Map<number, Match<R, C>>();
  for (const step of steps<R, C>()) {
    const pending = rows
      .map((row, index) => ({ row, index }))
      .filter(({ index }) => !found.has(index));
    const wanted = new Map<string, Identifier>();
    for (const { row } of pending) {
      for (const identifier of step.requests(row)) {
        const key = JSON.stringify(identifier).toLowerCase();
        if (!wanted.has(key)) {
          wanted.set(key, identifier);
        }
      }
    }
    if (wanted.size === 0) {
      continue;
    }
    const { cards } = await resolver.collection([...wanted.values()]);
    const byKey = new Map<string, C>();
    for (const card of cards) {
      for (const key of step.cardKeys(card)) {
        if (!byKey.has(key)) {
          byKey.set(key, card);
        }
      }
    }
    for (const { row, index } of pending) {
      const card = step
        .rowKeys(row)
        .map((key) => byKey.get(key))
        .find((hit) => hit !== undefined);
      if (card !== undefined) {
        found.set(index, { row, card, how: step.how });
      }
    }
  }
  const misses: Miss<R>[] = [];
  for (const [index, row] of rows.entries()) {
    if (found.has(index)) {
      continue;
    }
    const card = resolver.fuzzy === undefined ? undefined : await resolver.fuzzy(row.name);
    if (card === undefined) {
      misses.push({ row, reason: `No Scryfall card named "${row.name}"` });
    } else {
      found.set(index, { row, card, how: "fuzzy" });
    }
  }
  const matches = [...found.entries()].toSorted(([a], [b]) => a - b).map(([, match]) => match);
  return { matches, misses };
}
