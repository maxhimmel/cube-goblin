import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { CubePaths } from "./store.ts";
import { cubePaths, writeCard } from "./store.ts";
import { CURRENT } from "./diff.ts";
import { compareVersions, listVersions, saveVersion } from "./versions.ts";

let paths: CubePaths;
const NOW = new Date("2026-11-10T12:00:00.000Z");
const shock = {
  name: "Shock",
  oracleId: "00000000-0000-4000-8000-000000000001",
  status: "draft" as const,
  tags: [],
  notes: "",
  source: { batch: "workbench", line: 1, input: "Shock" },
};

beforeEach(async () => {
  paths = cubePaths(await mkdtemp(join(tmpdir(), "cube-versions-")));
  await mkdir(paths.root, { recursive: true });
  await writeFile(paths.tagsFile, JSON.stringify({ tags: [] }));
  await writeCard(paths, shock);
});

describe("saveVersion", () => {
  it("writes the whole cube state to a dated file and lists it", async () => {
    const result = await saveVersion(paths, { label: "Before trim" }, NOW);
    const summary = {
      id: "2026-11-10-before-trim",
      label: "Before trim",
      savedAt: NOW.toISOString(),
      counts: { draft: 1, prospect: 0, cut: 0 },
    };
    expect(result).toEqual({ ok: true, version: summary });
    expect(await listVersions(paths)).toEqual([summary]);
    const file = JSON.parse(
      await readFile(join(paths.versionsDir, "2026-11-10-before-trim.json"), "utf8"),
    ) as unknown;
    expect(file).toMatchObject({ cards: [shock], tags: [], board: { sections: [] } });
  });

  it("refuses a blank label or a repeated one on the same day", async () => {
    expect(await saveVersion(paths, { label: "  " }, NOW)).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(await saveVersion(paths, { label: "!!" }, NOW)).toMatchObject({
      ok: false,
      status: 400,
    });
    await saveVersion(paths, { label: "First" }, NOW);
    expect(await saveVersion(paths, { label: "first" }, NOW)).toMatchObject({
      ok: false,
      status: 409,
    });
  });
});

describe("compareVersions", () => {
  it("compares a saved version with the current cube", async () => {
    await saveVersion(paths, { label: "Start" }, NOW);
    await writeCard(paths, { ...shock, status: "cut" });
    const result = await compareVersions(paths, "2026-11-10-start", CURRENT);
    expect(result.ok && result.diff.cards).toMatchObject([
      { name: "Shock", before: "draft", after: "cut" },
    ]);
  });

  it("says which version is missing", async () => {
    expect(await compareVersions(paths, "nope", CURRENT)).toEqual({
      ok: false,
      status: 404,
      error: 'No version "nope"',
    });
  });
});
