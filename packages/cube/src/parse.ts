export interface BatchLine {
  line: number;
  input: string;
  name: string;
  sectionHeader: string | undefined;
}

export interface ParsedBatch {
  entries: BatchLine[];
  headers: string[];
}

const BULLET = /^\s*\[\s*[xX]?\s*\]\s*/u;
const SHORTCODE = /:[a-z0-9_+-]+:/giu;
const NON_TEXT = /[\p{Extended_Pictographic}\p{Emoji_Component}️‍\s]/gu;

export function isSectionHeader(text: string): boolean {
  const stripped = text.replace(SHORTCODE, "").replace(NON_TEXT, "");
  return text.trim().length > 0 && !/[\p{L}\p{N}]/u.test(stripped);
}

export function parseBatch(source: string): ParsedBatch {
  const entries: BatchLine[] = [];
  const headers: string[] = [];
  let sectionHeader: string | undefined;
  source.split(/\r?\n/u).forEach((raw, index) => {
    const text = raw.replace(BULLET, "").trim();
    if (text.length === 0) {
      return;
    }
    if (isSectionHeader(text)) {
      sectionHeader = text;
      headers.push(text);
      return;
    }
    entries.push({ line: index + 1, input: raw, name: text, sectionHeader });
  });
  return { entries, headers };
}
