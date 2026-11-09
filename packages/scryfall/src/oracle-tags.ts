import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import { z } from "zod";
import { DAY_MS } from "./cache.ts";
import type { ScryfallClient } from "./client.ts";
import type { ScryfallTag } from "./schemas.ts";
import { tagSchema } from "./schemas.ts";

export const ORACLE_TAGS_BULK_TYPE = "oracle-tags";

export type OracleTagIndex = Record<string, string[]>;

const storedSchema = z.strictObject({
  fetchedAt: z.number(),
  roots: z.array(z.string()),
  index: z.record(z.string(), z.array(z.string())),
});

type Stored = z.infer<typeof storedSchema>;

export function parseTagLines(text: string): ScryfallTag[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => tagSchema.parse(JSON.parse(line)));
}

export function indexOracleTags(
  tags: readonly ScryfallTag[],
  roots: readonly string[],
): OracleTagIndex {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  const index: OracleTagIndex = {};
  for (const root of roots) {
    const oracleIds = new Set<string>();
    const seen = new Set<string>();
    const queue = [root];
    for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
      const tag = byId.get(id);
      if (seen.has(id) || !tag) {
        continue;
      }
      seen.add(id);
      for (const tagging of tag.taggings) {
        if (tagging.oracle_id) {
          oracleIds.add(tagging.oracle_id);
        }
      }
      queue.push(...(tag.child_ids ?? []));
    }
    index[root] = [...oracleIds].sort();
  }
  return index;
}

export interface OracleTagLoad {
  index: OracleTagIndex;
  fetchedAt: number | undefined;
  stale: boolean;
  error?: string;
}

export interface OracleTagStoreOptions {
  client: ScryfallClient;
  file: string;
  ttlMs?: number;
  now?: () => number;
}

function sameRoots(stored: Stored, roots: readonly string[]): boolean {
  return roots.every((root) => stored.roots.includes(root));
}

export class OracleTagStore {
  readonly #client: ScryfallClient;
  readonly #file: string;
  readonly #ttlMs: number;
  readonly #now: () => number;

  constructor(options: OracleTagStoreOptions) {
    this.#client = options.client;
    this.#file = options.file;
    this.#ttlMs = options.ttlMs ?? DAY_MS;
    this.#now = options.now ?? Date.now;
  }

  async #read(): Promise<Stored | undefined> {
    try {
      return storedSchema.parse(JSON.parse(await readFile(this.#file, "utf8")));
    } catch {
      return undefined;
    }
  }

  async #fetch(roots: readonly string[]): Promise<Stored> {
    const bulk = await this.#client.bulkData(ORACLE_TAGS_BULK_TYPE);
    const uri = bulk.jsonl_download_uri;
    if (uri === undefined) {
      throw new Error(`Bulk data ${ORACLE_TAGS_BULK_TYPE} has no JSONL download`);
    }
    const bytes = await this.#client.download(uri);
    const text = gunzipSync(bytes).toString("utf8");
    const stored: Stored = {
      fetchedAt: this.#now(),
      roots: [...roots],
      index: indexOracleTags(parseTagLines(text), roots),
    };
    await mkdir(dirname(this.#file), { recursive: true });
    await writeFile(this.#file, JSON.stringify(stored));
    return stored;
  }

  async load(roots: readonly string[]): Promise<OracleTagLoad> {
    const stored = await this.#read();
    const usable = stored && sameRoots(stored, roots) ? stored : undefined;
    if (usable && this.#now() - usable.fetchedAt <= this.#ttlMs) {
      return { index: usable.index, fetchedAt: usable.fetchedAt, stale: false };
    }
    try {
      const fresh = await this.#fetch(roots);
      return { index: fresh.index, fetchedAt: fresh.fetchedAt, stale: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = usable ?? stored;
      return {
        index: fallback?.index ?? {},
        fetchedAt: fallback?.fetchedAt,
        stale: true,
        error: message,
      };
    }
  }
}
