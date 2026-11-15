import { writeArchidekt } from "./archidekt.ts";
import { writeArena } from "./arena.ts";
import { parseCockatrice, writeCockatrice } from "./cockatrice.ts";
import { parseCubeCobraCsv, writeCubeCobraCsv } from "./cubecobra-csv.ts";
import { parseCubeCobraJson } from "./cubecobra-json.ts";
import { parseDraftmancer, writeDraftmancer } from "./draftmancer.ts";
import { writeMoxfield } from "./moxfield.ts";
import { parseMtgoDek, writeMtgoDek, writeMtgoText } from "./mtgo.ts";
import { parseText } from "./text.ts";
import type { ExportCard, ExportMeta, ParsedList } from "./types.ts";
import { writeXmage } from "./xmage.ts";

export interface Carries {
  prospect: boolean;
  cut: boolean;
  tags: boolean;
  notes: boolean;
  printing: "id" | "set-number" | "set" | "none";
}

export interface CubeFormat {
  id: string;
  label: string;
  extension: string;
  carries: Carries;
  verified: boolean;
  write: (cards: readonly ExportCard[], meta: ExportMeta) => string;
}

export const EXPORT_FORMATS: readonly CubeFormat[] = [
  {
    id: "cubecobra-csv",
    label: "Cube Cobra (CSV)",
    extension: "csv",
    carries: { prospect: true, cut: true, tags: true, notes: true, printing: "set-number" },
    verified: true,
    write: writeCubeCobraCsv,
  },
  {
    id: "draftmancer",
    label: "Draftmancer",
    extension: "txt",
    carries: { prospect: false, cut: false, tags: false, notes: false, printing: "set-number" },
    verified: true,
    write: writeDraftmancer,
  },
  {
    id: "arena",
    label: "MTG Arena / MTGGoldfish",
    extension: "txt",
    carries: { prospect: true, cut: false, tags: false, notes: false, printing: "set-number" },
    verified: true,
    write: writeArena,
  },
  {
    id: "mtgo-txt",
    label: "MTGO (text)",
    extension: "txt",
    carries: { prospect: true, cut: false, tags: false, notes: false, printing: "none" },
    verified: true,
    write: writeMtgoText,
  },
  {
    id: "mtgo-dek",
    label: "MTGO (.dek)",
    extension: "dek",
    carries: { prospect: true, cut: false, tags: false, notes: false, printing: "id" },
    verified: true,
    write: writeMtgoDek,
  },
  {
    id: "moxfield",
    label: "Moxfield",
    extension: "txt",
    carries: { prospect: true, cut: false, tags: false, notes: false, printing: "set-number" },
    verified: false,
    write: writeMoxfield,
  },
  {
    id: "archidekt",
    label: "Archidekt",
    extension: "txt",
    carries: { prospect: true, cut: true, tags: true, notes: false, printing: "set-number" },
    verified: false,
    write: writeArchidekt,
  },
  {
    id: "cockatrice",
    label: "Cockatrice (.cod)",
    extension: "cod",
    carries: { prospect: true, cut: false, tags: false, notes: false, printing: "id" },
    verified: true,
    write: writeCockatrice,
  },
  {
    id: "xmage",
    label: "XMage (.dck)",
    extension: "dck",
    carries: { prospect: true, cut: false, tags: false, notes: false, printing: "set-number" },
    verified: true,
    write: writeXmage,
  },
];

export function exportFormat(id: string): CubeFormat | undefined {
  return EXPORT_FORMATS.find((format) => format.id === id);
}

export function formatLosses(format: CubeFormat): string[] {
  const { carries } = format;
  return [
    carries.prospect ? undefined : "prospects",
    carries.cut ? undefined : "cuts",
    carries.tags ? undefined : "tags",
    carries.notes ? undefined : "notes",
    carries.printing === "none" ? "printings" : undefined,
  ].filter((loss): loss is string => loss !== undefined);
}

export type ImportFormatId =
  "cubecobra-json" | "cubecobra-csv" | "cockatrice" | "mtgo-dek" | "draftmancer" | "text";

const SHEET_HEADER = /^\[[^\]:]+\]$/mu;

export function detectFormat(text: string): ImportFormatId {
  const trimmed = text.replace(/^\uFEFF/u, "").trimStart();
  if (trimmed.startsWith("{")) {
    return "cubecobra-json";
  }
  if (/<cockatrice_deck[\s>]/u.test(trimmed)) {
    return "cockatrice";
  }
  if (/<Deck[\s>]/u.test(trimmed) && /<Cards\s/u.test(trimmed)) {
    return "mtgo-dek";
  }
  const firstLine = trimmed.split(/\r?\n/u, 1)[0] ?? "";
  if (/^"?name"?\s*,/iu.test(firstLine)) {
    return "cubecobra-csv";
  }
  if (SHEET_HEADER.test(trimmed.replace(/\r/gu, ""))) {
    return "draftmancer";
  }
  return "text";
}

const PARSERS: Record<ImportFormatId, (text: string) => ParsedList> = {
  "cubecobra-json": parseCubeCobraJson,
  "cubecobra-csv": parseCubeCobraCsv,
  cockatrice: parseCockatrice,
  "mtgo-dek": parseMtgoDek,
  draftmancer: parseDraftmancer,
  text: parseText,
};

export function parseList(text: string): ParsedList & { format: ImportFormatId } {
  const source = text.replace(/^\uFEFF/u, "");
  const format = detectFormat(source);
  return { format, ...PARSERS[format](source) };
}

export { exportName, nameCandidates } from "./names.ts";
export type { NameStyle } from "./names.ts";
export { DEFAULT_BOARD_STATUS, boardStatus, normalizeBoard } from "./types.ts";
export type { Board, ExportCard, ExportMeta, ImportRow, ParsedList } from "./types.ts";
