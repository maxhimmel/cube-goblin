import { escapeXml, lineOf, xmlTags } from "./markup.ts";
import { exportName } from "./names.ts";
import { drafted, prospects } from "./statuses.ts";
import { cardLine, joinLines } from "./text.ts";
import type { LineStyle } from "./text.ts";
import type { ExportCard, ImportRow, ParsedList } from "./types.ts";
import { row } from "./types.ts";

const STYLE: LineStyle = { names: "mtgo", quantity: String, printing: () => "" };

export function writeMtgoText(cards: readonly ExportCard[]): string {
  return joinLines([
    ...drafted(cards).map((card) => cardLine(card, STYLE)),
    "",
    ...prospects(cards).map((card) => cardLine(card, STYLE)),
  ]);
}

export function writeMtgoDek(cards: readonly ExportCard[]): string {
  const entry = (card: ExportCard, sideboard: boolean) => {
    const catId = card.mtgoId === undefined ? "" : `CatID="${String(card.mtgoId)}" `;
    const name = escapeXml(exportName(card, "mtgo"));
    return `  <Cards ${catId}Quantity="1" Sideboard="${String(sideboard)}" Name="${name}" Annotation="0" />`;
  };
  return joinLines([
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Deck xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    "  <NetDeckID>0</NetDeckID>",
    "  <PreconstructedDeckID>0</PreconstructedDeckID>",
    ...drafted(cards).map((card) => entry(card, false)),
    ...prospects(cards).map((card) => entry(card, true)),
    "</Deck>",
  ]);
}

export function parseMtgoDek(text: string): ParsedList {
  const rows: ImportRow[] = [];
  for (const tag of xmlTags(text).filter((entry) => entry.name === "Cards" && !entry.closing)) {
    const name = tag.attributes["Name"] ?? "";
    if (name.length === 0) {
      continue;
    }
    const catId = Number(tag.attributes["CatID"]);
    const quantity = Number(tag.attributes["Quantity"] ?? "1");
    rows.push(
      row(
        {
          line: lineOf(text, tag.index),
          input: text.slice(tag.index, tag.end),
          name,
          board: tag.attributes["Sideboard"]?.toLowerCase() === "true" ? "side" : "main",
        },
        {
          quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
          mtgoId: Number.isInteger(catId) && catId > 0 ? catId : undefined,
        },
      ),
    );
  }
  return { rows };
}
