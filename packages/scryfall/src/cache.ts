import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface Cache {
  get(key: string): Promise<unknown>;
  peek(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  size(key: string): Promise<number | undefined>;
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
    try {
      const info = await stat(this.#path(key));
      if (this.#now() - info.mtimeMs > this.#ttlMs) {
        return undefined;
      }
    } catch {
      return undefined;
    }
    return this.peek(key);
  }

  async peek(key: string): Promise<unknown> {
    try {
      return JSON.parse(await readFile(this.#path(key), "utf8")) as unknown;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    await mkdir(this.#dir, { recursive: true });
    await writeFile(this.#path(key), JSON.stringify(value));
  }

  async size(key: string): Promise<number | undefined> {
    try {
      return (await stat(this.#path(key))).size;
    } catch {
      return undefined;
    }
  }
}

export class MemoryCache implements Cache {
  readonly #entries = new Map<string, unknown>();

  get(key: string): Promise<unknown> {
    return Promise.resolve(this.#entries.get(key));
  }

  peek(key: string): Promise<unknown> {
    return this.get(key);
  }

  set(key: string, value: unknown): Promise<void> {
    this.#entries.set(key, value);
    return Promise.resolve();
  }

  size(key: string): Promise<number | undefined> {
    const value = this.#entries.get(key);
    return Promise.resolve(value === undefined ? undefined : JSON.stringify(value).length);
  }
}
