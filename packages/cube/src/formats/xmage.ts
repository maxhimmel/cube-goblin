import { exportName } from "./names.ts";
import { drafted, prospects } from "./statuses.ts";
import { joinLines } from "./text.ts";
import type { ExportCard, ExportMeta } from "./types.ts";

function line(card: ExportCard): string {
  const printing =
    card.set === undefined || card.collectorNumber === undefined
      ? ""
      : `[${card.set.toUpperCase()}:${card.collectorNumber}] `;
  return `1 ${printing}${exportName(card, "front-except-split")}`;
}

export function writeXmage(cards: readonly ExportCard[], meta: ExportMeta): string {
  return joinLines([
    `NAME:${meta.name}`,
    ...drafted(cards).map(line),
    ...prospects(cards).map((card) => `SB: ${line(card)}`),
  ]);
}
