import { escapeXml, lineOf, xmlTags, xmlText } from "./markup.ts";
import { exportName } from "./names.ts";
import { joinLines } from "./text.ts";
import type { ExportCard, ExportMeta, ImportRow, ParsedList } from "./types.ts";
import { row } from "./types.ts";

const ZONES: Record<string, string> = { draft: "main", prospect: "maybeboard" };

const BOARDS: Record<string, string> = {
  main: "main",
  side: "side",
  maybeboard: "maybe",
  tokens: "tokens",
};

function cardElement(card: ExportCard): string {
  const attributes = [`number="1"`, `name="${escapeXml(exportName(card, "cockatrice"))}"`];
  if (card.set !== undefined) {
    attributes.push(`setShortName="${escapeXml(card.set.toUpperCase())}"`);
  }
  if (card.collectorNumber !== undefined) {
    attributes.push(`collectorNumber="${escapeXml(card.collectorNumber)}"`);
  }
  if (card.printingId !== undefined) {
    attributes.push(`uuid="${escapeXml(card.printingId)}"`);
  }
  return `        <card ${attributes.join(" ")}/>`;
}

export function writeCockatrice(cards: readonly ExportCard[], meta: ExportMeta): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<cockatrice_deck version="1">',
    `    <deckname>${escapeXml(meta.name)}</deckname>`,
    "    <comments></comments>",
  ];
  for (const [status, zone] of Object.entries(ZONES)) {
    const inZone = cards.filter((card) => card.status === status);
    if (inZone.length > 0) {
      lines.push(`    <zone name="${zone}">`, ...inZone.map(cardElement), "    </zone>");
    }
  }
  lines.push("</cockatrice_deck>");
  return joinLines(lines);
}

export function parseCockatrice(text: string): ParsedList {
  const rows: ImportRow[] = [];
  let zone = "main";
  for (const tag of xmlTags(text)) {
    if (tag.name === "zone" && !tag.closing) {
      const name = tag.attributes["name"] ?? "main";
      zone = BOARDS[name] ?? name;
      continue;
    }
    const name = tag.attributes["name"] ?? "";
    if (tag.name !== "card" || tag.closing || name.length === 0) {
      continue;
    }
    const quantity = Number(tag.attributes["number"] ?? "1");
    rows.push(
      row(
        { line: lineOf(text, tag.index), input: text.slice(tag.index, tag.end), name, board: zone },
        {
          quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1,
          set: tag.attributes["setShortName"]?.toLowerCase(),
          collectorNumber: tag.attributes["collectorNumber"],
          printingId: tag.attributes["uuid"],
        },
      ),
    );
  }
  const title = xmlText(text, "deckname");
  return title === undefined || title.length === 0 ? { rows } : { title, rows };
}
