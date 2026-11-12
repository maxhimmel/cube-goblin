import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CubePaths } from "./store.ts";

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

async function readRaw(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

async function writeRaw(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function sectionLabels(paths: CubePaths): Promise<Map<string, string>> {
  const file = join(paths.root, "sections.json");
  if (!(await exists(file))) {
    return new Map();
  }
  const raw = (await readRaw(file))["sections"];
  const sections = Array.isArray(raw) ? (raw as { id: string; label: string }[]) : [];
  return new Map(sections.map((section) => [section.id, section.label]));
}

async function migrateCards(paths: CubePaths): Promise<void> {
  if (!(await exists(paths.cardsDir))) {
    return;
  }
  const labels = await sectionLabels(paths);
  const files = (await readdir(paths.cardsDir)).filter((file) => file.endsWith(".json"));
  await Promise.all(
    files.map(async (file) => {
      const path = join(paths.cardsDir, file);
      const { section, ...card } = await readRaw(path);
      if (typeof section !== "string") {
        return;
      }
      const deck = `Deck: ${labels.get(section) ?? section}`;
      const notes = typeof card["notes"] === "string" ? card["notes"] : "";
      await writeRaw(path, { ...card, notes: notes === "" ? deck : `${notes}\n${deck}` });
    }),
  );
}

async function migrateBoard(paths: CubePaths): Promise<void> {
  if (!(await exists(paths.boardFile))) {
    return;
  }
  const { bins, ...board } = await readRaw(paths.boardFile);
  if (!Array.isArray(bins) || "sections" in board) {
    return;
  }
  await writeRaw(paths.boardFile, {
    ...board,
    sections: (bins as Record<string, unknown>[]).map((bin) => ({ tags: [], ...bin })),
  });
}

async function migrateTags(paths: CubePaths): Promise<void> {
  if (!(await exists(paths.tagsFile))) {
    await writeRaw(paths.tagsFile, { tags: [] });
  }
}

export async function migrateLegacyCube(paths: CubePaths): Promise<void> {
  await Promise.all([migrateCards(paths), migrateBoard(paths), migrateTags(paths)]);
}
