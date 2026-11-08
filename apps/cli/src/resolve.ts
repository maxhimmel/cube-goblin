import type { BatchLine } from "@repo/cube";
import type { Card, ScryfallClient } from "@repo/scryfall";
import { ScryfallError } from "@repo/scryfall";

export interface Resolved {
  entry: BatchLine;
  card: Card;
  how: "exact" | "fuzzy";
}

export interface Unresolved {
  entry: BatchLine;
  reason: string;
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[^a-z0-9]/gu, "");
}

function names(card: Card): string[] {
  return [card.name, ...(card.card_faces ?? []).map((face) => face.name)];
}

export async function resolveEntries(
  client: ScryfallClient,
  entries: readonly BatchLine[],
  onProgress: (done: number, total: number) => void = () => undefined,
): Promise<{ resolved: Resolved[]; unresolved: Unresolved[] }> {
  const { cards } = await client.collection(entries.map((entry) => ({ name: entry.name })));
  const byName = new Map<string, Card>();
  for (const card of cards) {
    for (const name of names(card)) {
      byName.set(normalizeName(name), card);
    }
  }

  const resolved: Resolved[] = [];
  const unresolved: Unresolved[] = [];
  let done = 0;
  for (const entry of entries) {
    const exact = byName.get(normalizeName(entry.name));
    if (exact) {
      resolved.push({ entry, card: exact, how: "exact" });
    } else {
      try {
        resolved.push({
          entry,
          card: await client.named(entry.name, { fuzzy: true }),
          how: "fuzzy",
        });
      } catch (error) {
        if (!(error instanceof ScryfallError)) {
          throw error;
        }
        unresolved.push({ entry, reason: error.message });
      }
    }
    done += 1;
    onProgress(done, entries.length);
  }
  return { resolved, unresolved };
}
