import { CARD_STATUSES } from "./schema.ts";
import type { Bucket, StatCard } from "./stats.ts";
import {
  CARD_TYPES,
  COLORS,
  CURVE_TOP,
  LAND,
  OTHER_TYPE,
  PT_TOP,
  VARIABLE_PT,
  frontType,
  isHeavy,
  isLand,
  typeKeys,
} from "./stats.ts";

export interface QueryCard extends StatCard {
  name?: string | undefined;
  oracleText?: string | undefined;
}

export type Test = (card: QueryCard) => boolean;

export const OPERATORS = [":", "=", "!=", "<", "<=", ">", ">="] as const;
export type Operator = (typeof OPERATORS)[number];

export type KeywordKind = "number" | "color" | "type" | "text" | "tag" | "status";

export interface Keyword {
  name: string;
  aliases: readonly string[];
  kind: KeywordKind;
  help: string;
  example: string;
  operators: readonly Operator[];
  values?: readonly string[];
}

const NUMBER_OPERATORS: readonly Operator[] = ["=", "!=", "<", "<=", ">", ">="];
const MATCH_OPERATORS: readonly Operator[] = [":"];
const COLOR_LETTERS = [...COLORS.map((color) => color.id.toLowerCase()), "m", "c"];
const STATUS_VALUES = [...CARD_STATUSES, "spell"];

export const KEYWORDS: readonly Keyword[] = [
  {
    name: "mv",
    aliases: ["cmc", "manavalue"],
    kind: "number",
    help: "Mana value (lands have none)",
    example: "mv<=2",
    operators: NUMBER_OPERATORS,
  },
  {
    name: "pow",
    aliases: ["power"],
    kind: "number",
    help: "Power; * for variable",
    example: "pow>=4",
    operators: NUMBER_OPERATORS,
  },
  {
    name: "tou",
    aliases: ["toughness"],
    kind: "number",
    help: "Toughness; compare with pow",
    example: "tou>pow",
    operators: NUMBER_OPERATORS,
  },
  {
    name: "c",
    aliases: ["color"],
    kind: "color",
    help: "Colors: c: has all of them, c= exactly; m multicolored, c colorless",
    example: "c:ub",
    operators: [":", "=", "!="],
    values: COLOR_LETTERS,
  },
  {
    name: "t",
    aliases: ["type"],
    kind: "type",
    help: "Type or subtype on the front face",
    example: "t:creature",
    operators: MATCH_OPERATORS,
    values: [...CARD_TYPES.map((type) => type.id), LAND.id, OTHER_TYPE.id],
  },
  {
    name: "o",
    aliases: ["oracle"],
    kind: "text",
    help: "Rules text contains",
    example: 'o:"draw a card"',
    operators: MATCH_OPERATORS,
  },
  {
    name: "name",
    aliases: [],
    kind: "text",
    help: "Name contains; a bare word does the same",
    example: "name:bolt",
    operators: MATCH_OPERATORS,
  },
  {
    name: "tag",
    aliases: [],
    kind: "tag",
    help: "Has the tag",
    example: "tag:removal",
    operators: MATCH_OPERATORS,
  },
  {
    name: "is",
    aliases: [],
    kind: "status",
    help: "draft, prospect, cut, or spell (not a land)",
    example: "is:prospect",
    operators: MATCH_OPERATORS,
    values: STATUS_VALUES,
  },
  {
    name: "heavy",
    aliases: [],
    kind: "color",
    help: "Two or more pips of the color",
    example: "heavy:r",
    operators: MATCH_OPERATORS,
    values: COLORS.map((color) => color.id.toLowerCase()),
  },
];

export const SYNTAX: readonly { syntax: string; help: string }[] = [
  { syntax: "a b", help: "both" },
  { syntax: "a or b", help: "either" },
  { syntax: "-a", help: "not" },
  { syntax: "(a or b) c", help: "group" },
  { syntax: '"two words"', help: "a value with spaces" },
];

export function keyword(name: string): Keyword | undefined {
  const lower = name.toLowerCase();
  return KEYWORDS.find((entry) => entry.name === lower || entry.aliases.includes(lower));
}

export interface Span {
  start: number;
  end: number;
}

export type QueryNode =
  | ({ type: "and" | "or"; parts: QueryNode[] } & Span)
  | ({ type: "not"; part: QueryNode } & Span)
  | ({ type: "term"; field: string; op: Operator; value: string } & Span)
  | ({ type: "word"; value: string } & Span);

type Token =
  ({ kind: "open" | "close" | "or" | "not" } & Span) | ({ kind: "text"; text: string } & Span);

export class QueryError extends Error {
  readonly at: number;

  constructor(message: string, at: number) {
    super(message);
    this.at = at;
  }
}

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
      tokens.push({ kind: char === "(" ? "open" : "close", start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (char === "-" && /[^\s)]/u.test(source[i + 1] ?? " ")) {
      tokens.push({ kind: "not", start: i, end: i + 1 });
      i += 1;
      continue;
    }
    const start = i;
    let text = "";
    while (i < source.length && !/[\s()]/u.test(source[i] ?? "")) {
      if (source[i] === '"') {
        const close = source.indexOf('"', i + 1);
        if (close < 0) {
          throw new QueryError("Missing closing quote", i);
        }
        text += source.slice(i + 1, close);
        i = close + 1;
        continue;
      }
      text += source[i] ?? "";
      i += 1;
    }
    tokens.push(
      text.toLowerCase() === "or"
        ? { kind: "or", start, end: i }
        : { kind: "text", text, start, end: i },
    );
  }
  return tokens;
}

const TERM = /^([a-z]+)(!=|<=|>=|:|=|<|>)(.*)$/isu;

function readTerm(token: Token & { kind: "text" }): QueryNode {
  const match = TERM.exec(token.text);
  if (!match) {
    return { type: "word", value: token.text, start: token.start, end: token.end };
  }
  const [, field = "", op = ":", value = ""] = match;
  const entry = keyword(field);
  if (!entry) {
    throw new QueryError(`Unknown keyword "${field}"`, token.start);
  }
  const operator = op as Operator;
  const allowed = entry.kind === "number" ? NUMBER_OPERATORS : entry.operators;
  const effective: Operator = entry.kind === "number" && operator === ":" ? "=" : operator;
  if (!allowed.includes(effective)) {
    throw new QueryError(`"${entry.name}" doesn't take ${op}`, token.start);
  }
  if (value === "") {
    throw new QueryError(`"${entry.name}${op}" needs a value`, token.end);
  }
  if (entry.kind === "number" && !isNumberValue(value)) {
    throw new QueryError(`"${entry.name}" needs a number, *, or mv/pow/tou`, token.start);
  }
  if (entry.kind === "color" && !isColorValue(value, entry)) {
    throw new QueryError(`"${entry.name}" takes ${entry.values?.join(" ") ?? ""}`, token.start);
  }
  if (entry.kind === "status" && !STATUS_VALUES.includes(value.toLowerCase())) {
    throw new QueryError(`"is" takes ${STATUS_VALUES.join(", ")}`, token.start);
  }
  return {
    type: "term",
    field: entry.name,
    op: effective,
    value,
    start: token.start,
    end: token.end,
  };
}

function isNumberValue(value: string): boolean {
  return (
    /^\d+(\.\d+)?$/u.test(value) || value === VARIABLE_PT.id || keyword(value)?.kind === "number"
  );
}

function isColorValue(value: string, entry: Keyword): boolean {
  const letters = Array.from(value.toLowerCase());
  return letters.length > 0 && letters.every((letter) => entry.values?.includes(letter));
}

export function parse(source: string): QueryNode | undefined {
  const tokens = tokenize(source);
  if (tokens.length === 0) {
    return undefined;
  }
  let at = 0;
  const peek = (): Token | undefined => tokens[at];

  function primary(): QueryNode {
    const token = tokens[at];
    if (!token) {
      throw new QueryError("Query ends too soon", source.length);
    }
    at += 1;
    if (token.kind === "not") {
      const part = primary();
      return { type: "not", part, start: token.start, end: part.end };
    }
    if (token.kind === "open") {
      const inner = either();
      const close = peek();
      if (close?.kind !== "close") {
        throw new QueryError("Missing )", source.length);
      }
      at += 1;
      return { ...inner, start: token.start, end: close.end };
    }
    if (token.kind === "text") {
      return readTerm(token);
    }
    throw new QueryError(
      token.kind === "or" ? '"or" needs something before it' : "Unexpected )",
      token.start,
    );
  }

  function both(): QueryNode {
    const parts = [primary()];
    while (at < tokens.length && peek()?.kind !== "or" && peek()?.kind !== "close") {
      parts.push(primary());
    }
    const [only] = parts;
    return parts.length === 1 && only
      ? only
      : { type: "and", parts, start: parts[0]?.start ?? 0, end: parts.at(-1)?.end ?? 0 };
  }

  function either(): QueryNode {
    const parts = [both()];
    while (peek()?.kind === "or") {
      at += 1;
      parts.push(both());
    }
    const [only] = parts;
    return parts.length === 1 && only
      ? only
      : { type: "or", parts, start: parts[0]?.start ?? 0, end: parts.at(-1)?.end ?? 0 };
  }

  const node = either();
  const extra = peek();
  if (extra) {
    throw new QueryError("Unexpected )", extra.start);
  }
  return node;
}

function numberOf(card: QueryCard, field: string): number | undefined {
  if (field === "mv") {
    return isLand(card) ? undefined : card.cmc;
  }
  const raw = field === "pow" ? card.power : card.toughness;
  return raw !== undefined && /^\d+$/u.test(raw) ? Number(raw) : undefined;
}

function compare(a: number, op: Operator, b: number): boolean {
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
    case ">=":
      return a >= b;
  }
}

function numberTest(field: string, op: Operator, value: string): Test {
  if (value === VARIABLE_PT.id) {
    return (card) => {
      const raw = field === "pow" ? card.power : field === "tou" ? card.toughness : undefined;
      const variable = raw !== undefined && !/^\d+$/u.test(raw);
      return op === "!=" ? raw !== undefined && !variable : variable;
    };
  }
  const other = keyword(value);
  const target = Number(value);
  return (card) => {
    const left = numberOf(card, field);
    const right = other ? numberOf(card, other.name) : target;
    return left !== undefined && right !== undefined && compare(left, op, right);
  };
}

function colorTest(op: Operator, value: string): Test {
  const letters = value.toLowerCase();
  if (letters === "m") {
    return (card) => (op === "!=" ? card.colors.length <= 1 : card.colors.length > 1);
  }
  if (letters === "c") {
    return (card) => (op === "!=" ? card.colors.length > 0 : card.colors.length === 0);
  }
  const wanted = Array.from(letters.toUpperCase());
  return (card) => {
    const has = wanted.every((color) => card.colors.includes(color));
    if (op === ":") {
      return has;
    }
    const exact = has && card.colors.length === wanted.length;
    return op === "=" ? exact : !exact;
  };
}

function typeTest(value: string): Test {
  const lower = value.toLowerCase();
  return (card) => typeKeys(card).includes(lower) || frontType(card).toLowerCase().includes(lower);
}

function termTest(field: string, op: Operator, value: string): Test {
  const lower = value.toLowerCase();
  switch (field) {
    case "mv":
    case "pow":
    case "tou":
      return numberTest(field, op, lower);
    case "c":
      return colorTest(op, lower);
    case "heavy":
      return (card) => Array.from(lower.toUpperCase()).every((color) => isHeavy(card, color));
    case "t":
      return typeTest(lower);
    case "o":
      return (card) => (card.oracleText ?? "").toLowerCase().includes(lower);
    case "tag":
      return (card) => card.tags?.includes(lower) ?? false;
    case "is":
      return lower === "spell" ? (card) => !isLand(card) : (card) => card.status === lower;
    default:
      return (card) => (card.name ?? "").toLowerCase().includes(lower);
  }
}

export function compile(node: QueryNode | undefined): Test {
  if (!node) {
    return () => true;
  }
  switch (node.type) {
    case "and": {
      const parts = node.parts.map(compile);
      return (card) => parts.every((part) => part(card));
    }
    case "or": {
      const parts = node.parts.map(compile);
      return (card) => parts.some((part) => part(card));
    }
    case "not": {
      const part = compile(node.part);
      return (card) => !part(card);
    }
    case "term":
      return termTest(node.field, node.op, node.value);
    case "word": {
      const lower = node.value.toLowerCase();
      return (card) => (card.name ?? "").toLowerCase().includes(lower);
    }
  }
}

export type QueryResult =
  { ok: true; test: Test; node: QueryNode | undefined } | { ok: false; error: string; at: number };

export function compileQuery(source: string): QueryResult {
  try {
    const node = parse(source);
    return { ok: true, test: compile(node), node };
  } catch (error) {
    if (error instanceof QueryError) {
      return { ok: false, error: error.message, at: error.at };
    }
    throw error;
  }
}

export function matchesQuery(card: QueryCard, source: string): boolean {
  const result = compileQuery(source);
  return result.ok && result.test(card);
}

function walk(
  node: QueryNode | undefined,
  visit: (term: QueryNode, negated: boolean) => void,
  negated = false,
): void {
  if (!node) {
    return;
  }
  if (node.type === "and" || node.type === "or") {
    for (const part of node.parts) {
      walk(part, visit, negated);
    }
    return;
  }
  if (node.type === "not") {
    walk(node.part, visit, !negated);
    return;
  }
  visit(node, negated);
}

export function namesStatus(source: string): boolean {
  const result = compileQuery(source);
  let found = false;
  if (result.ok) {
    walk(result.node, (term, negated) => {
      if (
        !negated &&
        term.type === "term" &&
        term.field === "is" &&
        term.value.toLowerCase() !== "spell"
      ) {
        found = true;
      }
    });
  }
  return found;
}

export function tagsIn(source: string): string[] {
  const result = compileQuery(source);
  const tags: string[] = [];
  if (result.ok) {
    walk(result.node, (term) => {
      if (term.type === "term" && term.field === "tag") {
        tags.push(term.value.toLowerCase());
      }
    });
  }
  return tags;
}

export interface QueryPart extends Span {
  text: string;
  kind: "term" | "group";
}

export function queryParts(source: string): QueryPart[] {
  const result = compileQuery(source);
  if (!result.ok || !result.node) {
    return [];
  }
  const top = result.node.type === "and" ? result.node.parts : [result.node];
  return top.map((node) => ({
    start: node.start,
    end: node.end,
    text: source.slice(node.start, node.end),
    kind: node.type === "term" || node.type === "word" ? "term" : "group",
  }));
}

export function removePart(source: string, part: Span): string {
  return `${source.slice(0, part.start)} ${source.slice(part.end)}`.replace(/\s+/gu, " ").trim();
}

export function quote(value: string): string {
  return /[\s()"]/u.test(value) ? `"${value.replaceAll('"', "")}"` : value;
}

export function term(field: string, op: Operator, value: string): string {
  return `${field}${op}${quote(value)}`;
}

export function joinQuery(...parts: readonly string[]): string {
  return parts
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => (/\sor\s/iu.test(part) && !part.startsWith("(") ? `(${part})` : part))
    .join(" ");
}

function curveTerm(key: string): string {
  return Number(key) >= CURVE_TOP ? `mv>=${key}` : `mv=${key}`;
}

function ptTerm(field: "pow" | "tou", key: string): string {
  if (key === VARIABLE_PT.id) {
    return `${field}=*`;
  }
  return Number(key) >= PT_TOP ? `${field}>=${key}` : `${field}=${key}`;
}

function colorGroupTerm(group: string): string {
  if (group === "multicolored") {
    return "c:m";
  }
  if (group === "colorless") {
    return "c=c";
  }
  return `c=${group.toLowerCase()}`;
}

export function bucketQuery(bucket: Bucket): string {
  const [first = "", second = ""] = bucket.keys;
  switch (bucket.kind) {
    case "curve":
      return curveTerm(first);
    case "color":
      return `is:spell ${colorGroupTerm(first)}`;
    case "colorCurve":
      return `is:spell ${colorGroupTerm(first)} ${curveTerm(second)}`;
    case "presence":
      return first === "multicolored" ? "is:spell c:m" : `is:spell c:${first.toLowerCase()}`;
    case "colorMulti":
      return `is:spell c:m c:${first.toLowerCase()}`;
    case "heavy":
      return `is:spell heavy:${first.toLowerCase()}`;
    case "type":
      return `t:${first}`;
    case "pt":
      return `t:creature ${ptTerm("pow", first)} ${ptTerm("tou", second)}`;
    case "body":
      return `t:creature pow=${quote(first)} tou=${quote(second)}`;
    case "status":
      return `is:${first}`;
    case "tag":
      return `tag:${first}`;
  }
}
