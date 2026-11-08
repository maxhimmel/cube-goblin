import type { CardEntry, CardPatch, Workbench } from "@repo/cube/browser";
import { cardEntrySchema, workbenchSchema } from "@repo/cube/browser";

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

export async function sendPatch(slug: string, patch: CardPatch): Promise<CardEntry> {
  const url = `/api/cards/${slug}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw await failure("PATCH", url, response);
  }
  return cardEntrySchema.parse(await response.json());
}
