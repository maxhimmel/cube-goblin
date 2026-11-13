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

function isLegacyTag(value: object): boolean {
  const keys = Object.keys(value).toSorted();
  return keys.length === 3 && keys.join(",") === "id,kind,label";
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isNoOpChange(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { before, after } = value as { before?: unknown; after?: unknown };
  return before !== undefined && sameJson(before, after);
}

export function dropTagKinds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(dropTagKinds);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (isLegacyTag(value)) {
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "kind"));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => {
      const next = dropTagKinds(inner);
      return [
        key,
        key === "tags" && Array.isArray(next)
          ? next.filter((change) => !isNoOpChange(change))
          : next,
      ];
    }),
  );
}

async function migrateTags(paths: CubePaths): Promise<void> {
  if (!(await exists(paths.tagsFile))) {
    await writeRaw(paths.tagsFile, { tags: [] });
    return;
  }
  const raw = await readRaw(paths.tagsFile);
  const next = dropTagKinds(raw);
  if (!sameJson(raw, next)) {
    await writeRaw(paths.tagsFile, next);
  }
}

async function migrateLog(paths: CubePaths): Promise<void> {
  if (!(await exists(paths.logFile))) {
    return;
  }
  const text = await readFile(paths.logFile, "utf8");
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const next = lines.map((line) => JSON.stringify(dropTagKinds(JSON.parse(line))));
  if (next.join("\n") !== lines.join("\n")) {
    await writeFile(paths.logFile, `${next.join("\n")}\n`);
  }
}

async function migrateVersions(paths: CubePaths): Promise<void> {
  if (!(await exists(paths.versionsDir))) {
    return;
  }
  const files = (await readdir(paths.versionsDir)).filter((file) => file.endsWith(".json"));
  await Promise.all(
    files.map(async (file) => {
      const path = join(paths.versionsDir, file);
      const raw = await readRaw(path);
      const next = dropTagKinds(raw);
      if (!sameJson(raw, next)) {
        await writeRaw(path, next);
      }
    }),
  );
}

export async function migrateLegacyCube(paths: CubePaths): Promise<void> {
  await Promise.all([
    migrateCards(paths),
    migrateBoard(paths),
    migrateTags(paths),
    migrateLog(paths),
    migrateVersions(paths),
  ]);
}
