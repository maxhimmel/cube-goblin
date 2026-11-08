import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface Cache {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export class FileCache implements Cache {
  readonly #dir: string;
  readonly #ttlMs: number;
  readonly #now: () => number;

  constructor(dir: string, ttlMs: number = DAY_MS, now: () => number = Date.now) {
    this.#dir = dir;
    this.#ttlMs = ttlMs;
    this.#now = now;
  }

  #path(key: string): string {
    return join(this.#dir, `${createHash("sha256").update(key).digest("hex")}.json`);
  }

  async get(key: string): Promise<unknown> {
    const path = this.#path(key);
    try {
      const info = await stat(path);
      if (this.#now() - info.mtimeMs > this.#ttlMs) {
        return undefined;
      }
      return JSON.parse(await readFile(path, "utf8")) as unknown;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    await mkdir(this.#dir, { recursive: true });
    await writeFile(this.#path(key), JSON.stringify(value));
  }
}

export class MemoryCache implements Cache {
  readonly #entries = new Map<string, unknown>();

  get(key: string): Promise<unknown> {
    return Promise.resolve(this.#entries.get(key));
  }

  set(key: string, value: unknown): Promise<void> {
    this.#entries.set(key, value);
    return Promise.resolve();
  }
}
