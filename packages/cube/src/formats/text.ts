import { exportName } from "./names.ts";
import type { NameStyle } from "./names.ts";
import type { Board, ExportCard, ImportRow, ParsedList } from "./types.ts";
import { normalizeBoard, row } from "./types.ts";

const HEADER =
  /^(?:\/\/\s*|#\s*)?(deck|main(?:deck|board)?|sideboard|side|maybe(?:board)?|commanders?|companion|considering|tokens)\s*:?\s*$/iu;
const HASH_BOARD = /^#\s*([a-z]+)$/u;
const CUT_HEADER = /^cut\s*:\s*$/iu;
const META = /^(name|author|about)\s*:\s*(.*)$/iu;
const COMMENT = /^(?:\/\/|#)(?!\d)/u;
const SIDEBOARD_PREFIX = /^SB:\s*/iu;
const QUANTITY = /^(\d+)\s*[xX]?\s+/u;
const XMAGE_PRINTING = /^\[([^\]:]+):([^\]]+)\]\s*/u;
const LABEL = /\s+\^([^^]+)\^$/u;
const CATEGORIES = /\s+\[([^\]]+)\]$/u;
const HASHTAGS = /(?:\s+#[!\w-]+)+$/u;
const FINISH = /\s+\*(?:F|E)\*$/u;
const ARENA_PRINTING = /\s+\(([A-Za-z0-9]{2,6})\)(?:\s+([A-Za-z0-9★†*+-]+))?$/u;
const BRACKET_PRINTING = /\s+\[([A-Za-z0-9]{2,6})\]\s+([A-Za-z0-9★†*+-]+)$/u;
const TRANSFORM = /\s*\(Transform\)$/iu;

export interface ParsedLine {
  name: string;
  quantity: number;
  sideboard: boolean;
  set?: string;
  collectorNumber?: string;
  tags: string[];
  categoryBoard?: Board;
}

const CATEGORY_BOARDS: Record<string, Board> = {
  maybeboard: "maybe",
  sideboard: "side",
  cut: "cut",
  commander: "main",
  tokens: "tokens",
};

export function parseCardLine(raw: string): ParsedLine | undefined {
  let text = raw;
  const sideboard = SIDEBOARD_PREFIX.test(text);
  text = text.replace(SIDEBOARD_PREFIX, "");
  const quantityMatch = QUANTITY.exec(text);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
  text = text.slice(quantityMatch?.[0].length ?? 0);
  let set: string | undefined;
  let collectorNumber: string | undefined;
  const xmage = XMAGE_PRINTING.exec(text);
  if (xmage) {
    set = xmage[1];
    collectorNumber = xmage[2];
    text = text.slice(xmage[0].length);
  }
  const tags: string[] = [];
  let categoryBoard: Board | undefined;
  for (;;) {
    const label = LABEL.exec(text);
    if (label) {
      text = text.slice(0, label.index);
      continue;
    }
    const categories = CATEGORIES.exec(text);
    if (categories && !BRACKET_PRINTING.test(text)) {
      text = text.slice(0, categories.index);
      for (const category of (categories[1] ?? "").split(",")) {
        const clean = category.replace(/\{[^}]*\}/gu, "").trim();
        const board = CATEGORY_BOARDS[clean.toLowerCase()];
        if (board !== undefined) {
          categoryBoard = board;
        } else if (clean.length > 0) {
          tags.push(clean);
        }
      }
      continue;
    }
    const hashtags = HASHTAGS.exec(text);
    if (hashtags) {
      text = text.slice(0, hashtags.index);
      const found = hashtags[0].trim().split(/\s+/u);
      tags.unshift(...found.map((tag) => tag.replace(/^#!?/u, "")));
      continue;
    }
    const finish = FINISH.exec(text);
    if (finish) {
      text = text.slice(0, finish.index);
      continue;
    }
    break;
  }
  if (set === undefined) {
    const printing = ARENA_PRINTING.exec(text) ?? BRACKET_PRINTING.exec(text);
    if (printing) {
      set = printing[1];
      collectorNumber = printing[2];
      text = text.slice(0, printing.index);
    }
  }
  const name = text.replace(TRANSFORM, "").trim();
  if (name.length === 0) {
    return undefined;
  }
  const parsed: ParsedLine = { name, quantity, sideboard, tags };
  if (set !== undefined) {
    parsed.set = set.toLowerCase();
  }
  if (collectorNumber !== undefined) {
    parsed.collectorNumber = collectorNumber;
  }
  if (categoryBoard !== undefined) {
    parsed.categoryBoard = categoryBoard;
  }
  return parsed;
}

export function normalizeLine(raw: string): string {
  return raw.replace(/[’‘]/gu, "'").replace(/\t/gu, " ").trim();
}

export function toRow(parsed: ParsedLine, line: number, input: string, board: Board): ImportRow {
  return row(
    {
      line,
      input,
      name: parsed.name,
      board: parsed.categoryBoard ?? (parsed.sideboard ? "side" : board),
    },
    {
      quantity: parsed.quantity,
      set: parsed.set,
      collectorNumber: parsed.collectorNumber,
      tags: parsed.tags,
    },
  );
}

export function parseText(text: string): ParsedList {
  const rows: ImportRow[] = [];
  let title: string | undefined;
  let board: Board = "main";
  let sawHeader = false;
  let blankUsed = false;
  text.split(/\r?\n/u).forEach((raw, index) => {
    const line = normalizeLine(raw);
    if (line.length === 0) {
      if (!sawHeader && !blankUsed && rows.length > 0) {
        board = "side";
        blankUsed = true;
      }
      return;
    }
    const header = HEADER.exec(line) ?? HASH_BOARD.exec(line);
    if (header ?? CUT_HEADER.test(line)) {
      board = normalizeBoard(header?.[1] ?? "cut");
      sawHeader = true;
      return;
    }
    const meta = META.exec(line);
    if (meta) {
      if ((meta[1] ?? "").toLowerCase() === "name" && (meta[2] ?? "").length > 0) {
        title = meta[2];
      }
      return;
    }
    if (COMMENT.test(line) || /^LAYOUT\s/u.test(line)) {
      return;
    }
    const parsed = parseCardLine(line);
    if (parsed) {
      rows.push(toRow(parsed, index + 1, raw, board));
    }
  });
  return title === undefined ? { rows } : { title, rows };
}

export interface LineStyle {
  names: NameStyle;
  quantity: (count: number) => string;
  printing: (card: ExportCard) => string;
}

export function cardLine(card: ExportCard, style: LineStyle, suffix = ""): string {
  const printing = style.printing(card);
  const tail = [printing, suffix].filter((part) => part.length > 0).join(" ");
  const head = `${style.quantity(1)} ${exportName(card, style.names)}`;
  return tail.length > 0 ? `${head} ${tail}` : head;
}

export function upperPrinting(card: ExportCard): string {
  if (card.set === undefined) {
    return "";
  }
  const set = `(${card.set.toUpperCase()})`;
  return card.collectorNumber === undefined ? set : `${set} ${card.collectorNumber}`;
}

export function joinLines(lines: readonly string[]): string {
  return `${lines.join("\n")}\n`;
}
