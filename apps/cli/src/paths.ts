import { fileURLToPath } from "node:url";
import { cubePaths } from "@repo/cube";

export const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
export const CACHE_DIR = fileURLToPath(new URL("../../../.cache/scryfall", import.meta.url));
export const IMAGE_CACHE_DIR = fileURLToPath(new URL("../../../.cache/images", import.meta.url));
export const SNAPSHOT_FILE = fileURLToPath(
  new URL("../../web/src/generated/snapshot.json", import.meta.url),
);
export const REVIEWS_DIR = fileURLToPath(new URL("../../../cube/reviews", import.meta.url));
export const CUBE_PATHS = cubePaths(REPO_ROOT);
