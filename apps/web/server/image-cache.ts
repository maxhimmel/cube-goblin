import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const IMAGE_ROUTE = "/api/image";
const ALLOWED_HOST = "cards.scryfall.io";
const MAX_PARALLEL = 6;
const DOWNLOAD_TIMEOUT_MS = 20_000;

export interface CachedImage {
  type: string;
  body: Buffer;
}

export function localImageUrl(remote: string): string {
  return `${IMAGE_ROUTE}?u=${encodeURIComponent(remote)}`;
}

export function isAllowedImage(remote: string): boolean {
  try {
    const url = new URL(remote);
    return url.protocol === "https:" && url.hostname === ALLOWED_HOST && url.port === "";
  } catch {
    return false;
  }
}

export class ImageCache {
  readonly #dir: string;
  readonly #userAgent: string;
  readonly #fetch: typeof fetch;
  readonly #inFlight = new Map<string, Promise<CachedImage>>();
  readonly #waiting: (() => void)[] = [];
  #active = 0;

  constructor(dir: string, userAgent: string, fetchImpl: typeof fetch = fetch) {
    this.#dir = dir;
    this.#userAgent = userAgent;
    this.#fetch = fetchImpl;
  }

  get(remote: string): Promise<CachedImage> {
    const existing = this.#inFlight.get(remote);
    if (existing) {
      return existing;
    }
    const pending = this.#load(remote).finally(() => {
      this.#inFlight.delete(remote);
    });
    this.#inFlight.set(remote, pending);
    return pending;
  }

  async #load(remote: string): Promise<CachedImage> {
    const key = createHash("sha256").update(remote).digest("hex");
    const bodyPath = join(this.#dir, `${key}.bin`);
    const typePath = join(this.#dir, `${key}.type`);
    try {
      const [body, type] = await Promise.all([readFile(bodyPath), readFile(typePath, "utf8")]);
      return { body, type };
    } catch {
      return this.#download(remote, bodyPath, typePath);
    }
  }

  async #download(remote: string, bodyPath: string, typePath: string): Promise<CachedImage> {
    await this.#acquire();
    try {
      const response = await this.#fetch(remote, {
        headers: { "User-Agent": this.#userAgent, Accept: "image/*" },
        redirect: "error",
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.startsWith("image/")) {
        throw new Error(`Image ${remote} failed: ${String(response.status)} ${type}`);
      }
      const body = Buffer.from(await response.arrayBuffer());
      const declared = response.headers.get("content-length");
      const compressed = response.headers.get("content-encoding") !== null;
      if (
        body.length === 0 ||
        (!compressed && declared !== null && Number(declared) !== body.length)
      ) {
        throw new Error(`Image ${remote} was truncated`);
      }
      await mkdir(this.#dir, { recursive: true });
      const suffix = `${String(process.pid)}.${randomUUID()}.tmp`;
      await writeFile(`${typePath}.${suffix}`, type);
      await rename(`${typePath}.${suffix}`, typePath);
      await writeFile(`${bodyPath}.${suffix}`, body);
      await rename(`${bodyPath}.${suffix}`, bodyPath);
      return { body, type };
    } finally {
      this.#release();
    }
  }

  async #acquire(): Promise<void> {
    if (this.#active < MAX_PARALLEL) {
      this.#active += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.#waiting.push(resolve);
    });
  }

  #release(): void {
    const next = this.#waiting.shift();
    if (next) {
      next();
    } else {
      this.#active -= 1;
    }
  }
}
