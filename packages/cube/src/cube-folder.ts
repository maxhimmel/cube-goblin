import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { CubeConfig } from "./schema.ts";
import { cubeConfigSchema } from "./schema.ts";
import { slugify } from "./slug.ts";
import type { CubePaths } from "./store.ts";
import { CONFIG_FILE, cubePaths, writeConfig, writeTags } from "./store.ts";

export const STARTER_CONFIG = {
  format: "winston",
  size: { min: 90, max: 100 },
} as const satisfies Omit<CubeConfig, "id" | "name">;

export class NotACubeFolder extends Error {
  constructor(dir: string) {
    super(`${dir} is not a cube folder: it has no ${CONFIG_FILE} or cards/ folder`);
    this.name = "NotACubeFolder";
  }
}

export interface CubeFolder {
  dir: string;
  paths: CubePaths;
  config: CubeConfig;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function looksLikeCube(dir: string): Promise<boolean> {
  return (await isFile(join(dir, CONFIG_FILE))) || (await isDirectory(join(dir, "cards")));
}

export async function findCubeFolder(dir: string): Promise<string | undefined> {
  const absolute = resolve(dir);
  const nested = join(absolute, "cube");
  if (!(await isDirectory(join(absolute, "cards"))) && (await isDirectory(join(nested, "cards")))) {
    return nested;
  }
  if (await looksLikeCube(absolute)) {
    return absolute;
  }
  return (await looksLikeCube(nested)) ? nested : undefined;
}

async function adoptRepoConfig(found: string, given: string): Promise<void> {
  const inside = join(found, CONFIG_FILE);
  const outside = join(given, CONFIG_FILE);
  if (found !== given && !(await isFile(inside)) && (await isFile(outside))) {
    await rename(outside, inside);
  }
}

async function rawConfig(file: string): Promise<Record<string, unknown>> {
  try {
    const raw: unknown = JSON.parse(await readFile(file, "utf8"));
    return typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function folderName(dir: string): string {
  const name = basename(dir);
  return name === "cube" ? basename(resolve(dir, "..")) : name;
}

export async function openCubeFolder(dir: string): Promise<CubeFolder> {
  const found = await findCubeFolder(dir);
  if (found === undefined) {
    throw new NotACubeFolder(dir);
  }
  await adoptRepoConfig(found, resolve(dir));
  const paths = cubePaths(found);
  const raw = await rawConfig(paths.configFile);
  const filled = {
    ...STARTER_CONFIG,
    ...raw,
    id: typeof raw["id"] === "string" && raw["id"] !== "" ? raw["id"] : randomUUID(),
    name:
      typeof raw["name"] === "string" && raw["name"].trim() !== ""
        ? raw["name"]
        : folderName(found),
  };
  const parsed = cubeConfigSchema.safeParse(filled);
  if (!parsed.success) {
    throw new Error(`${paths.configFile}: ${parsed.error.message}`);
  }
  if (JSON.stringify(parsed.data) !== JSON.stringify(raw)) {
    await writeConfig(paths, parsed.data);
  }
  return { dir: found, paths, config: parsed.data };
}

async function freeFolder(parent: string, name: string): Promise<string> {
  const base = slugify(name) || "cube";
  for (let n = 1; ; n += 1) {
    const dir = join(parent, n === 1 ? base : `${base}-${String(n)}`);
    try {
      await mkdir(dir);
      return dir;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
        throw error;
      }
    }
  }
}

export async function createCubeFolder(
  parent: string,
  name: string,
  settings: Omit<CubeConfig, "id" | "name"> = STARTER_CONFIG,
): Promise<CubeFolder> {
  const config = cubeConfigSchema.parse({ ...settings, id: randomUUID(), name });
  await mkdir(parent, { recursive: true });
  const dir = await freeFolder(parent, config.name);
  const paths = cubePaths(dir);
  await mkdir(paths.cardsDir);
  await writeTags(paths, []);
  await writeConfig(paths, config);
  return { dir, paths, config };
}
