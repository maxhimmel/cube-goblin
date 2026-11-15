import type { CubePaths, OfflineRun, OfflineStatus } from "@repo/cube";
import { FUNCTION_ORACLE_TAG_IDS, readCards } from "@repo/cube";
import type { OracleTagStore, ScryfallClient } from "@repo/scryfall";
import { displayFields, isUnreachable } from "@repo/scryfall";
import type { ImageCache } from "./image-cache.ts";

const PROBE_URL = "https://api.scryfall.com/";
export const PROBE_EVERY_MS = 15_000;
const PROBE_TIMEOUT_MS = 5_000;

function abortedByCaller(init: RequestInit | undefined): boolean {
  const reason: unknown = init?.signal?.reason;
  return init?.signal?.aborted === true && reason instanceof Error && reason.name === "AbortError";
}

export class Reachability {
  readonly #fetch: typeof fetch;
  readonly #userAgent: string;
  readonly #now: () => number;
  #online = true;
  #checkedAt = 0;

  constructor(fetchImpl: typeof fetch, userAgent: string, now: () => number = Date.now) {
    this.#fetch = fetchImpl;
    this.#userAgent = userAgent;
    this.#now = now;
  }

  readonly fetch: typeof fetch = async (input, init) => {
    let response: Response;
    try {
      response = await this.#fetch(input, init);
    } catch (error) {
      if (abortedByCaller(init)) {
        throw error;
      }
      this.#mark(false);
      if (isUnreachable(error)) {
        throw error;
      }
      throw new TypeError("Scryfall can't be reached", { cause: error });
    }
    this.#mark(true);
    return response;
  };

  #mark(online: boolean): void {
    this.#online = online;
    this.#checkedAt = this.#now();
  }

  async online(): Promise<boolean> {
    if (!this.#online && this.#now() - this.#checkedAt >= PROBE_EVERY_MS) {
      await this.fetch(PROBE_URL, {
        method: "HEAD",
        headers: { "User-Agent": this.#userAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      }).catch(() => undefined);
    }
    return this.#online;
  }
}

export interface OfflineDeps {
  client: ScryfallClient;
  oracleTags: OracleTagStore;
  images: ImageCache;
}

export async function cacheStatus(
  paths: CubePaths,
  deps: OfflineDeps,
): Promise<Omit<OfflineStatus, "run">> {
  const entries = await readCards(paths);
  const held = await Promise.all(
    entries.map(async (entry) => {
      const cached = await deps.client.cachedEntry(entry);
      const fields = cached.card ? displayFields(cached.card) : undefined;
      const images = fields
        ? await Promise.all([deps.images.size(fields.image), deps.images.size(fields.imageLarge)])
        : [undefined];
      const imageBytes = images.reduce<number>((sum, size) => sum + (size ?? 0), 0);
      return {
        bytes: cached.bytes + imageBytes,
        complete: cached.missing.length === 0 && images.every((size) => size !== undefined),
      };
    }),
  );
  const cached = held.filter((card) => card.complete).length;
  const tags = await deps.oracleTags.has(FUNCTION_ORACLE_TAG_IDS);
  return {
    cards: entries.length,
    cached,
    bytes: held.reduce((sum, card) => sum + card.bytes, 0),
    complete: tags && cached === entries.length,
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function prefetch(paths: CubePaths, deps: OfflineDeps, run: OfflineRun): Promise<void> {
  const entries = await readCards(paths);
  run.total = entries.length;
  const tags = await deps.oracleTags.load(FUNCTION_ORACLE_TAG_IDS);
  if (tags.error !== undefined && !(await deps.oracleTags.has(FUNCTION_ORACLE_TAG_IDS))) {
    throw new Error(`Oracle tags: ${tags.error}`);
  }
  const { cards } = await deps.client.forEntries(entries);
  await Promise.all(
    entries.map(async (entry) => {
      try {
        const card = cards.get(entry.oracleId);
        const fields = card ? displayFields(card) : undefined;
        if (!fields) {
          throw new Error(`No card data for ${entry.name}`);
        }
        await Promise.all([
          deps.client
            .cachedPrintings(entry.oracleId)
            .then((cached) => cached ?? deps.client.printings(entry.oracleId)),
          deps.images.get(fields.image),
          deps.images.get(fields.imageLarge),
        ]);
      } catch (error) {
        run.failed += 1;
        run.error ??= errorText(error);
      } finally {
        run.done += 1;
      }
    }),
  );
}

export class OfflineRuns {
  readonly #runs = new Map<string, OfflineRun>();

  get(cubeId: string): OfflineRun | undefined {
    const run = this.#runs.get(cubeId);
    return run && { ...run };
  }

  start(cubeId: string, paths: CubePaths, deps: OfflineDeps): void {
    if (this.#runs.get(cubeId)?.running === true) {
      return;
    }
    const run: OfflineRun = { running: true, done: 0, total: 0, failed: 0 };
    this.#runs.set(cubeId, run);
    void prefetch(paths, deps, run)
      .catch((error: unknown) => {
        run.error = errorText(error);
      })
      .finally(() => {
        run.running = false;
      });
  }
}
