import { ARENA_STYLE } from "./arena.ts";
import { drafted, prospects } from "./statuses.ts";
import { cardLine, joinLines } from "./text.ts";
import type { LineStyle } from "./text.ts";
import type { ExportCard } from "./types.ts";

const STYLE: LineStyle = { ...ARENA_STYLE, names: "spaced-slash" };

export function writeMoxfield(cards: readonly ExportCard[]): string {
  const side = prospects(cards);
  return joinLines([
    ...drafted(cards).map((card) => cardLine(card, STYLE)),
    ...(side.length > 0 ? ["", "SIDEBOARD:", ...side.map((card) => cardLine(card, STYLE))] : []),
  ]);
}
