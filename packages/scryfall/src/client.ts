import type { z } from "zod";
import type { Cache } from "./cache.ts";
import { MemoryCache } from "./cache.ts";
import type { Card, CardList } from "./schemas.ts";
import { cardListSchema, cardSchema, errorSchema } from "./schemas.ts";

export const API_BASE = "https://api.scryfall.com";
export const COLLECTION_MAX_IDENTIFIERS = 75;
export const CARD_ENDPOINT_INTERVAL_MS = 500;
export const DEFAULT_INTERVAL_MS = 100;

export class ScryfallError extends Error {
  readonly status: number;
  readonly code: string;
  readonly type: string | undefined;

  constructor(status: number, code: string, details: string, type?: string | null) {
    super(details);
    this.name = "ScryfallError";
    this.status = status;
    this.code = code;
    this.type = type ?? undefined;
  }
}

export type CardIdentifier =
  | { id: string }
  | { oracle_id: string }
  | { name: string }
  | { name: string; set: string }
  | { set: string; collector_number: string };

export interface ScryfallClientOptions {
  userAgent: string;
  cache?: Cache;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

interface RequestSpec {
  path: string;
  params?: Record<string, string>;
  body?: unknown;
}

function intervalFor(path: string): number {
  return path.startsWith("/cards/") ? CARD_ENDPOINT_INTERVAL_MS : DEFAULT_INTERVAL_MS;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export class ScryfallClient {
  readonly #userAgent: string;
  readonly #cache: Cache;
  readonly #fetch: typeof fetch;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #now: () => number;
  readonly #lastRequestAt = new Map<number, number>();

  constructor(options: ScryfallClientOptions) {
    this.#userAgent = options.userAgent;
    this.#cache = options.cache ?? new MemoryCache();
    this.#fetch = options.fetch ?? fetch;
    this.#sleep = options.sleep ?? defaultSleep;
    this.#now = options.now ?? Date.now;
  }

  async #throttle(path: string): Promise<void> {
    const interval = intervalFor(path);
    const last = this.#lastRequestAt.get(interval);
    const now = this.#now();
    const slot = last === undefined ? now : Math.max(now, last + interval);
    this.#lastRequestAt.set(interval, slot);
    if (slot > now) {
      await this.#sleep(slot - now);
    }
  }

  async #request<S extends z.ZodType>(spec: RequestSpec, schema: S): Promise<z.infer<S>> {
    const url = new URL(spec.path, API_BASE);
    for (const [key, value] of Object.entries(spec.params ?? {})) {
      url.searchParams.set(key, value);
    }
    const cacheKey = JSON.stringify([url.toString(), spec.body ?? null]);
    const cached = await this.#cache.get(cacheKey);
    if (cached !== undefined) {
      return schema.parse(cached);
    }

    await this.#throttle(spec.path);
    const init: RequestInit = {
      method: spec.body === undefined ? "GET" : "POST",
      headers: {
        "User-Agent": this.#userAgent,
        Accept: "application/json",
        ...(spec.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
    };
    if (spec.body !== undefined) {
      init.body = JSON.stringify(spec.body);
    }
    const response = await this.#fetch(url, init);
    const json: unknown = await response.json();

    if (!response.ok) {
      const error = errorSchema.safeParse(json);
      if (error.success) {
        throw new ScryfallError(
          error.data.status,
          error.data.code,
          error.data.details,
          error.data.type,
        );
      }
      throw new ScryfallError(response.status, "unknown", response.statusText);
    }

    const parsed = schema.parse(json);
    await this.#cache.set(cacheKey, json);
    return parsed;
  }

  named(name: string, options: { fuzzy?: boolean; set?: string } = {}): Promise<Card> {
    const params: Record<string, string> = { [options.fuzzy === true ? "fuzzy" : "exact"]: name };
    if (options.set !== undefined) {
      params["set"] = options.set;
    }
    return this.#request({ path: "/cards/named", params }, cardSchema);
  }

  async search(query: string, options: { limit?: number } = {}): Promise<Card[]> {
    const limit = options.limit ?? Number.POSITIVE_INFINITY;
    const cards: Card[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && cards.length < limit) {
      const list: CardList = await this.#request(
        { path: "/cards/search", params: { q: query, page: String(page) } },
        cardListSchema,
      );
      cards.push(...list.data);
      hasMore = list.has_more;
      page += 1;
    }
    return cards.slice(0, limit);
  }

  async collection(
    identifiers: readonly CardIdentifier[],
  ): Promise<{ cards: Card[]; notFound: unknown[] }> {
    const cards: Card[] = [];
    const notFound: unknown[] = [];
    for (const batch of chunk(identifiers, COLLECTION_MAX_IDENTIFIERS)) {
      const list = await this.#request(
        { path: "/cards/collection", body: { identifiers: batch } },
        cardListSchema,
      );
      cards.push(...list.data);
      notFound.push(...(list.not_found ?? []));
    }
    return { cards, notFound };
  }
}
