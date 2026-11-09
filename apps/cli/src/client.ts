import { join } from "node:path";
import { FileCache, OracleTagStore, ScryfallClient } from "@repo/scryfall";
import packageJson from "../package.json" with { type: "json" };
import { CACHE_DIR } from "./paths.ts";

export const USER_AGENT = `MaxsCubeCLI/${packageJson.version}`;

export function createClient(): ScryfallClient {
  return new ScryfallClient({ userAgent: USER_AGENT, cache: new FileCache(CACHE_DIR) });
}

export function createOracleTagStore(client: ScryfallClient): OracleTagStore {
  return new OracleTagStore({ client, file: join(CACHE_DIR, "oracle-tags.json") });
}
