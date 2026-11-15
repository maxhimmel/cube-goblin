import { fileURLToPath } from "node:url";

export const REPO_CUBE = fileURLToPath(new URL("../../../cube", import.meta.url));
export const CACHE_DIR = fileURLToPath(new URL("../../../.cache/scryfall", import.meta.url));
export const IMAGE_CACHE_DIR = fileURLToPath(new URL("../../../.cache/images", import.meta.url));
export const SNAPSHOT_FILE = fileURLToPath(
  new URL("../../web/src/generated/snapshot.json", import.meta.url),
);
