import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { IMAGE_CACHE_DIR } from "./paths.ts";

export async function imageDataUri(url: string, key: string, userAgent: string): Promise<string> {
  const path = join(IMAGE_CACHE_DIR, `${key}.jpg`);
  let bytes: Buffer;
  try {
    bytes = await readFile(path);
  } catch {
    const response = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "image/*" } });
    if (!response.ok) {
      throw new Error(`Image fetch failed ${String(response.status)}: ${url}`);
    }
    bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(IMAGE_CACHE_DIR, { recursive: true });
    await writeFile(path, bytes);
  }
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}
