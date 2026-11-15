import type { CardEntry, Tag } from "../schema.ts";
import type { ExportCard } from "./types.ts";

export interface PrintingInfo {
  id: string;
  layout: string;
  set: string;
  collector_number: string;
  mtgo_id?: number | undefined;
}

export function toExportCards(
  entries: readonly CardEntry[],
  tags: readonly Tag[],
  printingOf: (entry: CardEntry) => PrintingInfo | undefined,
): ExportCard[] {
  const labels = new Map(tags.map((tag) => [tag.id, tag.label]));
  return entries
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const printing = printingOf(entry);
      const card: ExportCard = {
        name: entry.name,
        layout: printing?.layout ?? "normal",
        status: entry.status,
        tags: entry.tags.map((id) => labels.get(id) ?? id),
        notes: entry.notes,
      };
      if (printing !== undefined) {
        card.set = printing.set;
        card.collectorNumber = printing.collector_number;
        card.printingId = printing.id;
        if (printing.mtgo_id !== undefined) {
          card.mtgoId = printing.mtgo_id;
        }
      }
      return card;
    });
}
