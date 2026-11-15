import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { saveConfig } from "./save-config.ts";
import type { CubePaths } from "./store.ts";
import { cubePaths, readConfig } from "./store.ts";

describe("saveConfig", () => {
  let paths: CubePaths;
  const before = { id: "c1", name: "Test", format: "winston", size: { min: 90, max: 100 } };

  beforeEach(async () => {
    paths = cubePaths(await mkdtemp(join(tmpdir(), "cube-config-")));
    await writeFile(paths.configFile, `${JSON.stringify(before)}\n`);
  });

  it("writes a valid config to cube.config.json", async () => {
    const next = { ...before, size: { min: 80, max: 90 } };
    expect(await saveConfig(paths, next)).toEqual({ ok: true, config: next });
    expect(await readConfig(paths)).toEqual(next);
  });

  it("rejects a range with min above max and leaves the file alone", async () => {
    const result = await saveConfig(paths, { ...before, size: { min: 100, max: 90 } });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(JSON.parse(await readFile(paths.configFile, "utf8"))).toEqual(before);
  });

  it("keeps the cube's id", async () => {
    const result = await saveConfig(paths, { ...before, id: "other" });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(await readConfig(paths)).toEqual(before);
  });

  it("rejects unknown formats", async () => {
    const result = await saveConfig(paths, { ...before, format: "draft" });
    expect(result.ok).toBe(false);
  });
});
