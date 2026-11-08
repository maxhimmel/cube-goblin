import { FileCache, ScryfallClient } from "@repo/scryfall";
import packageJson from "../package.json" with { type: "json" };
import { CACHE_DIR } from "./paths.ts";

export function createClient(): ScryfallClient {
  return new ScryfallClient({
    userAgent: `MaxsCubeCLI/${packageJson.version}`,
    cache: new FileCache(CACHE_DIR),
  });
}
