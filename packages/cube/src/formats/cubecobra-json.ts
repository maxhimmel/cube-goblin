import type { ImportRow, ParsedList } from "./types.ts";
import { normalizeBoard, row } from "./types.ts";

interface CubeCobraCard {
  cardID?: unknown;
  custom_name?: unknown;
  name?: unknown;
  tags?: unknown;
  notes?: unknown;
  details?: { name?: unknown; set?: unknown; collector_number?: unknown };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function parseCubeCobraJson(source: string): ParsedList {
  const cube = JSON.parse(source) as { name?: unknown; cards?: Record<string, unknown> };
  const rows: ImportRow[] = [];
  let line = 0;
  for (const [boardName, cards] of Object.entries(cube.cards ?? {})) {
    if (!Array.isArray(cards)) {
      continue;
    }
    for (const card of cards as CubeCobraCard[]) {
      line += 1;
      const name = text(card.details?.name) ?? text(card.name) ?? text(card.custom_name);
      if (name === undefined) {
        continue;
      }
      rows.push(
        row(
          { line, input: name, name, board: normalizeBoard(boardName) },
          {
            printingId: text(card.cardID),
            set: text(card.details?.set)?.toLowerCase(),
            collectorNumber: text(card.details?.collector_number),
            tags: Array.isArray(card.tags)
              ? card.tags.filter((tag): tag is string => typeof tag === "string")
              : [],
            notes: text(card.notes) ?? "",
          },
        ),
      );
    }
  }
  const title = text(cube.name);
  return title === undefined ? { rows } : { title, rows };
}
