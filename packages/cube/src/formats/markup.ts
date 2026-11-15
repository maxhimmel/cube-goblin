const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/gu, (char) => XML_ESCAPES[char] ?? char);
}

export function unescapeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/giu, (whole, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    }
    if (lower.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    }
    const named = Object.entries(XML_ESCAPES).find(([, value]) => value === `&${lower};`);
    return named?.[0] ?? whole;
  });
}

export interface XmlTag {
  name: string;
  closing: boolean;
  attributes: Record<string, string>;
  index: number;
  end: number;
}

export function xmlTags(text: string): XmlTag[] {
  const tags: XmlTag[] = [];
  for (const match of text.matchAll(
    /<(\/?)([A-Za-z_][\w.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*\/?>/gu,
  )) {
    const attributes: Record<string, string> = {};
    for (const attr of (match[3] ?? "").matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) {
      attributes[attr[1] ?? ""] = unescapeXml(attr[2] ?? attr[3] ?? "");
    }
    tags.push({
      name: match[2] ?? "",
      closing: match[1] === "/",
      attributes,
      index: match.index,
      end: match.index + match[0].length,
    });
  }
  return tags;
}

export function xmlText(text: string, element: string): string | undefined {
  const match = new RegExp(`<${element}>([\\s\\S]*?)</${element}>`, "u").exec(text);
  return match?.[1] === undefined ? undefined : unescapeXml(match[1]).trim();
}

export function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let quoted = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index] ?? "";
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 2;
        continue;
      }
      if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      current.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      current.push(cell);
      rows.push(current);
      current = [];
      cell = "";
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
    } else {
      cell += char;
    }
    index += 1;
  }
  if (cell.length > 0 || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }
  return rows.filter((cells) => cells.some((value) => value.length > 0));
}

const FORMULA_START = /^[=+\-@\t\r]/u;

export function csvCell(value: string): string {
  const numeric = /^-?\d+(?:\.\d+)?$/u.test(value);
  const guarded = !numeric && FORMULA_START.test(value) ? `'${value}` : value;
  return `"${guarded.replaceAll('"', '""')}"`;
}

export function uncsvCell(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}
