import { csvCell, parseCsv, uncsvCell } from "./markup.ts";
import { exportName } from "./names.ts";
import type { Board, ExportCard, ImportRow, ParsedList } from "./types.ts";
import { normalizeBoard, row } from "./types.ts";

export const CUBECOBRA_CSV_HEADER = [
  "name",
  "CMC",
  "Type",
  "Color",
  "Set",
  "Collector Number",
  "Rarity",
  "Color Category",
  "status",
  "Finish",
  "board",
  "maybeboard",
  "image URL",
  "image Back URL",
  "tags",
  "Notes",
  "MTGO ID",
  "Custom",
  "Voucher",
  "Artist",
  "Voucher Cards",
] as const;

const BOARD_NAMES: Record<string, string> = {
  draft: "mainboard",
  prospect: "maybeboard",
  cut: "cut",
};

function headerKey(header: string): string {
  return header.toLowerCase().replace(/\s+/gu, "");
}

export function writeCubeCobraCsv(cards: readonly ExportCard[]): string {
  const lines = [CUBECOBRA_CSV_HEADER.map(csvCell).join(",")];
  for (const card of cards) {
    const board = BOARD_NAMES[card.status] ?? "mainboard";
    const values: Record<(typeof CUBECOBRA_CSV_HEADER)[number], string> = {
      name: exportName(card, "front-except-split"),
      CMC: "",
      Type: "",
      Color: "",
      Set: card.set?.toLowerCase() ?? "",
      "Collector Number": card.collectorNumber ?? "",
      Rarity: "",
      "Color Category": "",
      status: "Not Owned",
      Finish: "Non-foil",
      board,
      maybeboard: String(board === "maybeboard"),
      "image URL": "",
      "image Back URL": "",
      tags: card.tags.join(";"),
      Notes: card.notes,
      "MTGO ID": String(card.mtgoId ?? -1),
      Custom: "false",
      Voucher: "false",
      Artist: "",
      "Voucher Cards": "",
    };
    lines.push(CUBECOBRA_CSV_HEADER.map((column) => csvCell(values[column])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

function csvBoard(cells: Record<string, string>): Board {
  const board = cells["board"] ?? "";
  if (board.trim().length > 0) {
    return normalizeBoard(board);
  }
  return (cells["maybeboard"] ?? "").toLowerCase() === "true" ? "maybe" : "main";
}

export function parseCubeCobraCsv(text: string): ParsedList {
  const lines = text.split(/\r?\n/u);
  const [header, ...records] = parseCsv(text);
  if (header === undefined) {
    return { rows: [] };
  }
  const keys = header.map(headerKey);
  const rows: ImportRow[] = [];
  let searchFrom = 1;
  for (const record of records) {
    const cells: Record<string, string> = {};
    keys.forEach((key, index) => {
      cells[key] = uncsvCell(record[index] ?? "").trim();
    });
    const name = cells["name"] ?? "";
    if (name.length === 0) {
      continue;
    }
    const found = lines.findIndex((value, index) => index >= searchFrom && value.includes(name));
    const lineIndex = found === -1 ? searchFrom : found;
    searchFrom = lineIndex + 1;
    const mtgoId = Number(cells["mtgoid"]);
    rows.push(
      row(
        { line: lineIndex + 1, input: lines[lineIndex] ?? "", name, board: csvBoard(cells) },
        {
          set: cells["set"] ? cells["set"].toLowerCase() : undefined,
          collectorNumber: cells["collectornumber"] === "" ? undefined : cells["collectornumber"],
          mtgoId: Number.isInteger(mtgoId) && mtgoId > 0 ? mtgoId : undefined,
          tags: (cells["tags"] ?? "")
            .split(";")
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
          notes: cells["notes"] ?? "",
        },
      ),
    );
  }
  return { rows };
}
