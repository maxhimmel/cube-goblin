import type { ExportCard } from "./types.ts";

export function drafted(cards: readonly ExportCard[]): ExportCard[] {
  return cards.filter((card) => card.status === "draft");
}

export function prospects(cards: readonly ExportCard[]): ExportCard[] {
  return cards.filter((card) => card.status === "prospect");
}
