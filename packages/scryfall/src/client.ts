import type { z } from "zod";
import type { Cache } from "./cache.ts";
import { MemoryCache } from "./cache.ts";
import type { BulkData, Card, CardList } from "./schemas.ts";
import { bulkDataSchema, cardListSchema, cardSchema, errorSchema } from "./schemas.ts";

export const API_BASE = "https://api.scryfall.com";
export const COLLECTION_MAX_IDENTIFIERS = 75;
export const CARD_ENDPOINT_INTERVAL_MS = 500;
export const DEFAULT_INTERVAL_MS = 100;
export const BULK_HOST = "data.scryfall.io";

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
  cache?: boolean;
}

function oracleKey(oracleId: string): string {
  return `oracle:${oracleId}`;
}

function printKey(id: string): string {
  return `print:${id}`;
}

export interface PrintedEntry {
  oracleId: string;
  printing?: string | undefined;
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
    const useCache = spec.cache !== false;
    const cacheKey = JSON.stringify([url.toString(), spec.body ?? null]);
    const cached = useCache ? await this.#cache.get(cacheKey) : undefined;
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
    if (useCache) {
      await this.#cache.set(cacheKey, json);
    }
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

  async #byKeys(
    ids: readonly string[],
    kind: "oracle_id" | "id",
  ): Promise<{ cards: Map<string, Card>; missing: string[] }> {
    const keyOf = kind === "id" ? printKey : oracleKey;
    const idOf = (card: Card): string | undefined => (kind === "id" ? card.id : card.oracle_id);
    const unique = [...new Set(ids)];
    const found = new Map<string, Card>();
    const toFetch: string[] = [];
    for (const id of unique) {
      const cached = cardSchema.safeParse(await this.#cache.get(keyOf(id)));
      if (cached.success) {
        found.set(id, cached.data);
      } else {
        toFetch.push(id);
      }
    }
    for (const batch of chunk(toFetch, COLLECTION_MAX_IDENTIFIERS)) {
      const list = await this.#request(
        {
          path: "/cards/collection",
          body: { identifiers: batch.map((id) => ({ [kind]: id })) },
          cache: false,
        },
        cardListSchema,
      );
      for (const card of list.data) {
        const id = idOf(card);
        if (id !== undefined) {
          found.set(id, card);
          await this.#cache.set(keyOf(id), card);
        }
      }
    }
    return { cards: found, missing: unique.filter((id) => !found.has(id)) };
  }

  async byOracleIds(oracleIds: readonly string[]): Promise<{ cards: Card[]; missing: string[] }> {
    const { cards, missing } = await this.#byKeys(oracleIds, "oracle_id");
    return {
      cards: [...new Set(oracleIds)].flatMap((oracleId) => cards.get(oracleId) ?? []),
      missing,
    };
  }

  async byIds(ids: readonly string[]): Promise<{ cards: Card[]; missing: string[] }> {
    const { cards, missing } = await this.#byKeys(ids, "id");
    return { cards: [...new Set(ids)].flatMap((id) => cards.get(id) ?? []), missing };
  }

  async forEntries(
    entries: readonly PrintedEntry[],
  ): Promise<{ cards: Map<string, Card>; missing: string[] }> {
    const chosen = entries.flatMap((entry) => entry.printing ?? []);
    const [defaults, printed] = await Promise.all([
      this.#byKeys(
        entries.map((entry) => entry.oracleId),
        "oracle_id",
      ),
      this.#byKeys(chosen, "id"),
    ]);
    const cards = new Map<string, Card>();
    for (const entry of entries) {
      const printing = entry.printing === undefined ? undefined : printed.cards.get(entry.printing);
      const card =
        printing?.oracle_id === entry.oracleId ? printing : defaults.cards.get(entry.oracleId);
      if (card) {
        cards.set(entry.oracleId, card);
      }
    }
    return { cards, missing: defaults.missing };
  }

  async printings(oracleId: string): Promise<Card[]> {
    const cards: Card[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const list: CardList = await this.#request(
        {
          path: "/cards/search",
          params: {
            q: `oracleid:${oracleId} game:paper`,
            unique: "prints",
            include_variations: "true",
            order: "released",
            dir: "desc",
            page: String(page),
          },
        },
        cardListSchema,
      );
      cards.push(...list.data);
      hasMore = list.has_more;
      page += 1;
    }
    return cards;
  }

  bulkData(type: string): Promise<BulkData> {
    return this.#request({ path: `/bulk-data/${type}`, cache: false }, bulkDataSchema);
  }

  async download(uri: string): Promise<Uint8Array> {
    const url = new URL(uri);
    if (url.protocol !== "https:" || url.hostname !== BULK_HOST) {
      throw new Error(`Refusing to download from ${url.hostname}`);
    }
    const response = await this.#fetch(url, { headers: { "User-Agent": this.#userAgent } });
    if (!response.ok) {
      throw new ScryfallError(response.status, "download", response.statusText);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}
