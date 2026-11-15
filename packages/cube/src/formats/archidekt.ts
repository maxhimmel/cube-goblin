import { cardLine, joinLines } from "./text.ts";
import type { LineStyle } from "./text.ts";
import type { ExportCard } from "./types.ts";

const ARCHIDEKT_STATUS: Record<string, string | undefined> = {
  draft: undefined,
  prospect: "Maybeboard{noDeck}{noPrice}",
  cut: "Cut{noDeck}",
};

function archidektPrinting(card: ExportCard): string {
  if (card.set === undefined) {
    return "";
  }
  const set = `(${card.set.toLowerCase()})`;
  return card.collectorNumber === undefined ? set : `${set} ${card.collectorNumber}`;
}

const STYLE: LineStyle = {
  names: "full",
  quantity: (count) => `${String(count)}x`,
  printing: archidektPrinting,
};

export function archidektCategory(tag: string): string {
  return tag
    .replace(/[,[\]{}^]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function writeArchidekt(cards: readonly ExportCard[]): string {
  return joinLines(
    cards.map((card) => {
      const categories = [
        ...card.tags.map(archidektCategory),
        ARCHIDEKT_STATUS[card.status],
      ].filter((category): category is string => category !== undefined && category.length > 0);
      return cardLine(card, STYLE, categories.length > 0 ? `[${categories.join(",")}]` : "");
    }),
  );
}
