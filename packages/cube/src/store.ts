import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";
import type { CardEntry, CubeConfig, Section, Tag } from "./schema.ts";
import { slugify } from "./slug.ts";
import { cardEntrySchema, cubeConfigSchema, sectionsFileSchema, tagsFileSchema } from "./schema.ts";

export interface CubePaths {
  root: string;
  cardsDir: string;
  sectionsFile: string;
  tagsFile: string;
  configFile: string;
}

export function cubePaths(repoRoot: string): CubePaths {
  return {
    root: join(repoRoot, "cube"),
    cardsDir: join(repoRoot, "cube", "cards"),
    sectionsFile: join(repoRoot, "cube", "sections.json"),
    tagsFile: join(repoRoot, "cube", "tags.json"),
    configFile: join(repoRoot, "cube.config.json"),
  };
}

async function readJson<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S>> {
  const raw: unknown = JSON.parse(await readFile(path, "utf8"));
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`${path}: ${result.error.message}`);
  }
  return result.data;
}

export function readConfig(paths: CubePaths): Promise<CubeConfig> {
  return readJson(paths.configFile, cubeConfigSchema);
}

export async function readSections(paths: CubePaths): Promise<Section[]> {
  return (await readJson(paths.sectionsFile, sectionsFileSchema)).sections;
}

export async function readTags(paths: CubePaths): Promise<Tag[]> {
  return (await readJson(paths.tagsFile, tagsFileSchema)).tags;
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, path);
}

export async function writeTags(paths: CubePaths, tags: readonly Tag[]): Promise<void> {
  await writeJsonAtomic(paths.tagsFile, tagsFileSchema.parse({ tags }));
}

export async function readCards(paths: CubePaths): Promise<CardEntry[]> {
  let files: string[];
  try {
    files = await readdir(paths.cardsDir);
  } catch {
    return [];
  }
  const cards = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => readJson(join(paths.cardsDir, file), cardEntrySchema)),
  );
  return cards;
}

export async function writeCard(paths: CubePaths, card: CardEntry): Promise<string> {
  await mkdir(paths.cardsDir, { recursive: true });
  const path = join(paths.cardsDir, `${slugify(card.name)}.json`);
  await writeJsonAtomic(path, cardEntrySchema.parse(card));
  return path;
}
