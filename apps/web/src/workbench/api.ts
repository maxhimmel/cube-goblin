import type {
  CardChange,
  CardEntry,
  NewCard,
  SearchResult,
  Tag,
  TagKind,
  Workbench,
} from "@repo/cube/browser";
import {
  cardEntrySchema,
  searchResultSchema,
  tagSchema,
  workbenchSchema,
} from "@repo/cube/browser";

export const CUBE_QUERY_KEY = ["cube"] as const;
export const CUBE_CHANGED_EVENT = "cube:changed";

function errorMessage(text: string): string {
  try {
    const body = JSON.parse(text) as { error?: unknown };
    return typeof body.error === "string" ? body.error : text;
  } catch {
    return text;
  }
}

async function failure(method: string, url: string, response: Response): Promise<Error> {
  const message = errorMessage(await response.text());
  return new Error(`${method} ${url} failed (${String(response.status)}): ${message}`);
}

export async function fetchCube(): Promise<Workbench> {
  const response = await fetch("/api/cube");
  if (!response.ok) {
    throw await failure("GET", "/api/cube", response);
  }
  return workbenchSchema.parse(await response.json());
}

async function sendJson(
  method: string,
  url: string,
  body: unknown,
  keepalive = false,
): Promise<unknown> {
  const response = await fetch(url, {
    method,
    keepalive,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await failure(method, url, response);
  }
  return response.json();
}

export async function sendChanges(changes: CardChange[], keepalive = false): Promise<CardEntry[]> {
  return cardEntrySchema
    .array()
    .parse(await sendJson("PATCH", "/api/cards", { changes }, keepalive));
}

export async function searchCards(query: string, signal: AbortSignal): Promise<SearchResult[]> {
  const url = `/api/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw await failure("GET", url, response);
  }
  return searchResultSchema.array().parse(await response.json());
}

export async function addCardRequest(card: NewCard): Promise<CardEntry> {
  return cardEntrySchema.parse(await sendJson("POST", "/api/cards", card));
}

export async function createTagRequest(label: string, kind: TagKind): Promise<Tag> {
  return tagSchema.parse(await sendJson("POST", "/api/tags", { label, kind }));
}

export async function changeTagRequest(
  id: string,
  change: { label?: string; kind?: TagKind },
): Promise<Tag> {
  return tagSchema.parse(await sendJson("PATCH", `/api/tags/${id}`, change));
}
