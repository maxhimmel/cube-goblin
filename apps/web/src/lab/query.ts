import { colorGroup, isLand, typeKeys } from "@repo/cube/browser";
import type { GridCard } from "../modes/mode.ts";
import type { Test } from "./model.ts";

export interface Keyword {
  names: string[];
  kind: "number" | "text" | "color" | "status";
  help: string;
  example: string;
}

export const KEYWORDS: Keyword[] = [
  { names: ["mv", "cmc"], kind: "number", help: "Mana value", example: "mv<=2" },
  { names: ["pow", "power"], kind: "number", help: "Power", example: "pow>=4" },
  { names: ["tou", "toughness"], kind: "number", help: "Toughness", example: "tou>pow" },
  {
    names: ["c", "color"],
    kind: "color",
    help: "Has every color named (m multicolored, c colorless)",
    example: "c:ub",
  },
  { names: ["t", "type"], kind: "text", help: "Type line contains", example: "t:creature" },
  { names: ["o", "oracle"], kind: "text", help: "Rules text contains", example: 'o:"draw a card"' },
  { names: ["tag"], kind: "text", help: "Has the tag", example: "tag:removal" },
  { names: ["is"], kind: "status", help: "Status: draft, prospect, cut", example: "is:prospect" },
  {
    names: ["name"],
    kind: "text",
    help: "Name contains (a bare word does the same)",
    example: "bolt",
  },
];

export const SYNTAX_NOTES: { syntax: string; help: string }[] = [
  { syntax: "a b", help: "both" },
  { syntax: "a or b", help: "either" },
  { syntax: "-a", help: "not" },
  { syntax: "( … )", help: "group" },
  { syntax: "= != < <= > >= :", help: "compare; numbers can compare with each other" },
];

type Token = { kind: "open" | "close" | "or" | "not" } | { kind: "term"; text: string };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i] ?? "";
    if (/\s/u.test(char)) {
      i += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ kind: char === "(" ? "open" : "close" });
      i += 1;
      continue;
    }
    if (char === "-" && i + 1 < source.length && !/\s/u.test(source[i + 1] ?? " ")) {
      tokens.push({ kind: "not" });
      i += 1;
      continue;
    }
    let text = "";
    while (i < source.length && !/[\s()]/u.test(source[i] ?? "")) {
      if (source[i] === '"') {
        const end = source.indexOf('"', i + 1);
        const stop = end < 0 ? source.length : end;
        text += source.slice(i + 1, stop);
        i = stop + 1;
        continue;
      }
      text += source[i] ?? "";
      i += 1;
    }
    tokens.push(text.toLowerCase() === "or" ? { kind: "or" } : { kind: "term", text });
  }
  return tokens;
}

function numberOf(card: GridCard, field: string): number | undefined {
  if (field === "mv" || field === "cmc") {
    return isLand(card) ? undefined : card.cmc;
  }
  const raw = field === "pow" || field === "power" ? card.power : card.toughness;
  return raw !== undefined && /^\d+$/u.test(raw) ? Number(raw) : undefined;
}

function compare(a: number, op: string, b: number): boolean {
  switch (op) {
    case ":":
    case "=":
      return a === b;
    case "!=":
      return a !== b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    default:
      return a >= b;
  }
}

const COLOR_NAMES: Record<string, string> = {
  white: "w",
  blue: "u",
  black: "b",
  red: "r",
  green: "g",
};

function term(text: string): Test {
  const match = /^([a-z]+)(:|!=|<=|>=|=|<|>)(.*)$/iu.exec(text);
  if (!match) {
    const needle = text.toLowerCase();
    return (card) => card.name.toLowerCase().includes(needle);
  }
  const [, rawField = "", op = ":", rawValue = ""] = match;
  const field = rawField.toLowerCase();
  const value = rawValue.toLowerCase();
  const keyword = KEYWORDS.find((entry) => entry.names.includes(field));
  if (!keyword) {
    throw new Error(`Unknown keyword "${field}"`);
  }
  if (keyword.kind === "number") {
    const other = KEYWORDS.find((entry) => entry.kind === "number" && entry.names.includes(value));
    const target = Number(value);
    if (!other && Number.isNaN(target)) {
      throw new Error(`"${field}" needs a number or another number field`);
    }
    return (card) => {
      const left = numberOf(card, field);
      const right = other ? numberOf(card, value) : target;
      return left !== undefined && right !== undefined && compare(left, op, right);
    };
  }
  if (keyword.kind === "color") {
    const letters = COLOR_NAMES[value] ?? value;
    if (letters === "m") {
      return (card) => !isLand(card) && colorGroup(card) === "multicolored";
    }
    if (letters === "c") {
      return (card) => card.colors.length === 0;
    }
    const wanted = Array.from(letters.toUpperCase());
    return (card) => wanted.every((color) => card.colors.includes(color));
  }
  if (keyword.kind === "status") {
    return (card) => card.status === value;
  }
  if (field === "t" || field === "type") {
    return (card) => card.typeLine.toLowerCase().includes(value) || typeKeys(card).includes(value);
  }
  if (field === "o" || field === "oracle") {
    return (card) => card.oracleText.toLowerCase().includes(value);
  }
  if (field === "tag") {
    return (card) => card.tags.some((tag) => tag.toLowerCase() === value.replaceAll(" ", "-"));
  }
  return (card) => card.name.toLowerCase().includes(value);
}

export function parseQuery(source: string): Test {
  const tokens = tokenize(source);
  let at = 0;
  const peek = (): Token | undefined => tokens[at];

  function primary(): Test {
    const token = tokens[at];
    at += 1;
    if (!token) {
      throw new Error("Query ends too soon");
    }
    if (token.kind === "not") {
      const inner = primary();
      return (card) => !inner(card);
    }
    if (token.kind === "open") {
      const inner = either();
      if (peek()?.kind !== "close") {
        throw new Error("Missing )");
      }
      at += 1;
      return inner;
    }
    if (token.kind === "term") {
      return term(token.text);
    }
    throw new Error(`Unexpected ${token.kind}`);
  }

  function both(): Test {
    const parts = [primary()];
    while (at < tokens.length && peek()?.kind !== "or" && peek()?.kind !== "close") {
      parts.push(primary());
    }
    return (card) => parts.every((part) => part(card));
  }

  function either(): Test {
    const parts = [both()];
    while (peek()?.kind === "or") {
      at += 1;
      parts.push(both());
    }
    return (card) => parts.some((part) => part(card));
  }

  if (tokens.length === 0) {
    throw new Error("Empty query");
  }
  const test = either();
  if (at < tokens.length) {
    throw new Error("Unexpected )");
  }
  return test;
}

export function tryQuery(source: string): { test?: Test; error?: string } {
  try {
    return { test: parseQuery(source) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
