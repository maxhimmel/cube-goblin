import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { CubePaths } from "./store.ts";
import { cubePaths, readVersionFiles, versionProblems, writeCard } from "./store.ts";
import { CURRENT } from "./diff.ts";
import { compareVersions, listVersions, localDate, saveVersion } from "./versions.ts";

let paths: CubePaths;
const NOW = new Date(2026, 10, 10, 12);
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

describe("localDate", () => {
  it("uses the local calendar day, not the UTC one", () => {
    expect(localDate(new Date(2026, 10, 10, 23, 59))).toBe("2026-11-10");
    expect(localDate(new Date(2026, 0, 2, 0, 1))).toBe("2026-01-02");
  });
});

describe("version files", () => {
  it("skips and reports a broken file or one whose id doesn't match its name", async () => {
    await saveVersion(paths, { label: "Good" }, NOW);
    const good = await readFile(join(paths.versionsDir, "2026-11-10-good.json"), "utf8");
    await writeFile(join(paths.versionsDir, "copy.json"), good);
    await writeFile(join(paths.versionsDir, "broken.json"), "{");
    expect((await listVersions(paths)).map((version) => version.id)).toEqual(["2026-11-10-good"]);
    const problems = versionProblems(await readVersionFiles(paths));
    expect(problems).toHaveLength(2);
    expect(problems.join("\n")).toMatch(/copy\.json: id "2026-11-10-good" does not match/u);
  });
});
