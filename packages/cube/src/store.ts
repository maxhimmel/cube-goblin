import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { z } from "zod";
import { EMPTY_BOARD } from "./board.ts";
import type { FiltersFile } from "./filters.ts";
import { EMPTY_FILTERS, filtersFileSchema } from "./filters.ts";
import type { LayoutsFile } from "./layouts.ts";
import type { LogEntry } from "./log.ts";
import { logEntrySchema } from "./log.ts";
import { EMPTY_LAYOUTS, layoutsFileSchema } from "./layouts.ts";
import type { Board, CardEntry, CubeConfig, Tag, Version } from "./schema.ts";
import { slugify } from "./slug.ts";
import {
  boardSchema,
  cardEntrySchema,
  cubeConfigSchema,
  tagsFileSchema,
  versionSchema,
} from "./schema.ts";

export const WORKBENCH_BATCH = "workbench";

export interface CubePaths {
  root: string;
  cardsDir: string;
  tagsFile: string;
  boardFile: string;
  filtersFile: string;
  layoutsFile: string;
  versionsDir: string;
  logFile: string;
  configFile: string;
  workbenchBatch: string;
}

export function cubePaths(repoRoot: string): CubePaths {
  return {
    root: join(repoRoot, "cube"),
    cardsDir: join(repoRoot, "cube", "cards"),
    tagsFile: join(repoRoot, "cube", "tags.json"),
    boardFile: join(repoRoot, "cube", "board.json"),
    filtersFile: join(repoRoot, "cube", "filters.json"),
    layoutsFile: join(repoRoot, "cube", "layouts.json"),
    versionsDir: join(repoRoot, "cube", "versions"),
    logFile: join(repoRoot, "cube", "log.jsonl"),
    configFile: join(repoRoot, "cube.config.json"),
    workbenchBatch: join(repoRoot, "cube", "inbox", `${WORKBENCH_BATCH}.txt`),
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

export async function readTags(paths: CubePaths): Promise<Tag[]> {
  return (await readJson(paths.tagsFile, tagsFileSchema)).tags;
}

export async function readBoard(paths: CubePaths): Promise<Board> {
  try {
    return await readJson(paths.boardFile, boardSchema);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return EMPTY_BOARD;
    }
    throw error;
  }
}

export async function readFilters(paths: CubePaths): Promise<FiltersFile> {
  try {
    return await readJson(paths.filtersFile, filtersFileSchema);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return EMPTY_FILTERS;
    }
    throw error;
  }
}

export async function readLayouts(paths: CubePaths): Promise<LayoutsFile> {
  try {
    return await readJson(paths.layoutsFile, layoutsFileSchema);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return EMPTY_LAYOUTS;
    }
    throw error;
  }
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, path);
}

export async function writeTags(paths: CubePaths, tags: readonly Tag[]): Promise<void> {
  await writeJsonAtomic(paths.tagsFile, tagsFileSchema.parse({ tags }));
}

export async function writeBoard(paths: CubePaths, board: Board): Promise<void> {
  await writeJsonAtomic(paths.boardFile, boardSchema.parse(board));
}

export async function writeFilters(paths: CubePaths, file: FiltersFile): Promise<void> {
  await writeJsonAtomic(paths.filtersFile, filtersFileSchema.parse(file));
}

export async function writeLayouts(paths: CubePaths, file: LayoutsFile): Promise<void> {
  await writeJsonAtomic(paths.layoutsFile, layoutsFileSchema.parse(file));
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

export async function deleteCard(paths: CubePaths, card: CardEntry): Promise<void> {
  await rm(join(paths.cardsDir, `${slugify(card.name)}.json`), { force: true });
}

export async function writeCard(paths: CubePaths, card: CardEntry): Promise<string> {
  await mkdir(paths.cardsDir, { recursive: true });
  const path = join(paths.cardsDir, `${slugify(card.name)}.json`);
  await writeJsonAtomic(path, cardEntrySchema.parse(card));
  return path;
}

export type VersionFile = { file: string; version: Version } | { file: string; error: string };

export async function readVersionFiles(paths: CubePaths): Promise<VersionFile[]> {
  let files: string[];
  try {
    files = await readdir(paths.versionsDir);
  } catch {
    return [];
  }
  return Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map(async (file): Promise<VersionFile> => {
        try {
          const version = await readJson(join(paths.versionsDir, file), versionSchema);
          return file === `${version.id}.json`
            ? { file, version }
            : {
                file,
                error: `cube/versions/${file}: id "${version.id}" does not match the file name`,
              };
        } catch (error) {
          return { file, error: error instanceof Error ? error.message : String(error) };
        }
      }),
  );
}

export function versionProblems(files: readonly VersionFile[]): string[] {
  return files.flatMap((entry) => ("error" in entry ? [entry.error] : []));
}

export async function readVersions(paths: CubePaths): Promise<Version[]> {
  return (await readVersionFiles(paths))
    .flatMap((entry) => ("version" in entry ? [entry.version] : []))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function writeVersion(paths: CubePaths, version: Version): Promise<string> {
  await mkdir(paths.versionsDir, { recursive: true });
  const path = join(paths.versionsDir, `${version.id}.json`);
  await writeJsonAtomic(path, versionSchema.parse(version));
  return path;
}

export async function readLog(paths: CubePaths): Promise<LogEntry[]> {
  let text: string;
  try {
    text = await readFile(paths.logFile, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return text
    .split("\n")
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.trim() !== "")
    .map(({ line, index }) => {
      const result = logEntrySchema.safeParse(JSON.parse(line));
      if (!result.success) {
        throw new Error(`${paths.logFile}:${String(index + 1)}: ${result.error.message}`);
      }
      return result.data;
    });
}

export async function appendLog(paths: CubePaths, entry: LogEntry): Promise<void> {
  await appendFile(paths.logFile, `${JSON.stringify(logEntrySchema.parse(entry))}\n`);
}
