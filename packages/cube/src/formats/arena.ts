import { drafted, prospects } from "./statuses.ts";
import { cardLine, joinLines, upperPrinting } from "./text.ts";
import type { LineStyle } from "./text.ts";
import type { ExportCard } from "./types.ts";

export const ARENA_STYLE: LineStyle = { names: "full", quantity: String, printing: upperPrinting };

export function writeArena(cards: readonly ExportCard[]): string {
  const side = prospects(cards);
  return joinLines([
    "Deck",
    ...drafted(cards).map((card) => cardLine(card, ARENA_STYLE)),
    ...(side.length > 0
      ? ["", "Sideboard", ...side.map((card) => cardLine(card, ARENA_STYLE))]
      : []),
  ]);
}
