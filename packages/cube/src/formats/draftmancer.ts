import { exportName } from "./names.ts";
import { joinLines, normalizeLine, parseCardLine, toRow } from "./text.ts";
import type { Board, ExportCard, ExportMeta, ImportRow, ParsedList } from "./types.ts";

export const DRAFTMANCER_PLAYERS = 2;
export const DRAFTMANCER_PACK_SIZE = 15;

const SECTION = /^\[([^\]{(]+?)\s*(?:\(\d+\))?\s*(?:\{.*\})?\]$/u;
const FOIL = /\s+\+?F$/u;

export function writeDraftmancer(cards: readonly ExportCard[], meta: ExportMeta): string {
  const boostersPerPlayer = Math.max(
    1,
    Math.floor(meta.size.min / (DRAFTMANCER_PLAYERS * DRAFTMANCER_PACK_SIZE)),
  );
  const settings = { name: meta.name, boostersPerPlayer };
  const lines = ["[Settings]", JSON.stringify(settings, undefined, 2), "[Main]"];
  for (const card of cards.filter((entry) => entry.status === "draft")) {
    const printing =
      card.set === undefined
        ? ""
        : ` (${card.set.toUpperCase()})${card.collectorNumber === undefined ? "" : ` ${card.collectorNumber}`}`;
    lines.push(`1 ${exportName(card, "full")}${printing}`);
  }
  return joinLines(lines);
}

function settingsName(json: string): string | undefined {
  const match = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/u.exec(json);
  if (match?.[1] === undefined) {
    return undefined;
  }
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return match[1];
  }
}

export function parseDraftmancer(text: string): ParsedList {
  const rows: ImportRow[] = [];
  const settings: string[] = [];
  let section = "";
  let board: Board = "main";
  text.split(/\r?\n/u).forEach((raw, index) => {
    const line = normalizeLine(raw);
    const header = SECTION.exec(line);
    if (header) {
      section = (header[1] ?? "").trim().toLowerCase();
      return;
    }
    if (section === "settings") {
      settings.push(line);
      return;
    }
    if (section === "customcards" || section === "layouts" || line.length === 0) {
      return;
    }
    if (line.startsWith("#")) {
      if (line === "# maybeboard") {
        board = "maybe";
      }
      return;
    }
    const parsed = parseCardLine(line.replace(FOIL, ""));
    if (parsed) {
      rows.push(toRow(parsed, index + 1, raw, board));
    }
  });
  const title = settingsName(settings.join("\n"));
  return title === undefined ? { rows } : { title, rows };
}
