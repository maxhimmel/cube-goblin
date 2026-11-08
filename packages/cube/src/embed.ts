import type { Review } from "./snapshot.ts";
import { REVIEW_SCRIPT_ID, reviewSchema } from "./snapshot.ts";

const OPEN = `<script id="${REVIEW_SCRIPT_ID}" type="application/json">`;
const CLOSE = "</script>";
const BODY_END = "</body>";

const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

export function serializeForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(LINE_SEPARATOR, "\\u2028")
    .replaceAll(PARAGRAPH_SEPARATOR, "\\u2029");
}

interface Split {
  before: string;
  json: string | undefined;
  after: string;
}

function splitTrailingReview(html: string): Split {
  const bodyEnd = html.lastIndexOf(BODY_END);
  if (bodyEnd === -1) {
    throw new Error("Document has no </body>");
  }
  const head = html.slice(0, bodyEnd).trimEnd();
  const after = html.slice(bodyEnd);
  const open = head.lastIndexOf(OPEN);
  const isTrailingTag =
    open !== -1 && head.endsWith(CLOSE) && head.indexOf(CLOSE, open) === head.length - CLOSE.length;
  if (!isTrailingTag) {
    return { before: head, json: undefined, after };
  }
  return {
    before: head.slice(0, open),
    json: head.slice(open + OPEN.length, head.length - CLOSE.length),
    after,
  };
}

export function embedReview(html: string, review: Review): string {
  const { before, after } = splitTrailingReview(html);
  return `${before}${OPEN}${serializeForScript(review)}${CLOSE}${after}`;
}

export function extractReview(html: string): Review | undefined {
  const { json } = splitTrailingReview(html);
  return json === undefined ? undefined : reviewSchema.parse(JSON.parse(json));
}
