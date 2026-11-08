import { fileURLToPath } from "node:url";
import { FileCache, ScryfallClient } from "@repo/scryfall";
import packageJson from "../package.json" with { type: "json" };

const CACHE_DIR = fileURLToPath(new URL("../../../.cache/scryfall", import.meta.url));

export function createClient(): ScryfallClient {
  return new ScryfallClient({
    userAgent: `MaxsCubeCLI/${packageJson.version}`,
    cache: new FileCache(CACHE_DIR),
  });
}
