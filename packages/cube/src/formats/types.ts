import type { CardStatus } from "../schema.ts";

export type Board = "main" | "side" | "maybe" | "cut" | "tokens" | (string & {});

export interface ImportRow {
  line: number;
  input: string;
  name: string;
  quantity: number;
  board: Board;
  set?: string;
  collectorNumber?: string;
  printingId?: string;
  mtgoId?: number;
  tags: string[];
  notes: string;
}

export interface ParsedList {
  title?: string;
  rows: ImportRow[];
}

export interface ExportCard {
  name: string;
  layout: string;
  status: CardStatus;
  set?: string;
  collectorNumber?: string;
  printingId?: string;
  mtgoId?: number;
  tags: string[];
  notes: string;
}

export interface ExportMeta {
  name: string;
  size: { min: number; max: number };
}

export const DEFAULT_BOARD_STATUS: Readonly<Record<string, CardStatus | "skip">> = {
  main: "draft",
  side: "prospect",
  maybe: "prospect",
  cut: "cut",
  tokens: "skip",
};

export function boardStatus(board: Board): CardStatus | "skip" {
  return DEFAULT_BOARD_STATUS[board] ?? "prospect";
}

export function normalizeBoard(raw: string): Board {
  const key = raw.toLowerCase().replace(/\s+/gu, "");
  if (["main", "mainboard", "maindeck", "deck"].includes(key)) {
    return "main";
  }
  if (["side", "sideboard", "commander", "commanders", "companion"].includes(key)) {
    return "side";
  }
  if (["maybe", "maybeboard", "considering"].includes(key)) {
    return "maybe";
  }
  if (key === "token" || key === "tokens") {
    return "tokens";
  }
  return key;
}

export function row(
  base: Pick<ImportRow, "line" | "input" | "name" | "board">,
  extra: {
    [K in keyof Omit<ImportRow, "line" | "input" | "name" | "board">]?: ImportRow[K] | undefined;
  } = {},
): ImportRow {
  const result: ImportRow = { quantity: 1, tags: [], notes: "", ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) {
      Object.assign(result, { [key]: value });
    }
  }
  return result;
}
