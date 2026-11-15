import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { STARTER_CONFIG, createCubeFolder, findCubeFolder, openCubeFolder } from "./cube-folder.ts";
import { readCards, readConfig, readTags } from "./store.ts";

let parent: string;

beforeEach(async () => {
  parent = await mkdtemp(join(tmpdir(), "cube-folder-"));
});

describe("createCubeFolder", () => {
  it("makes an empty cube named after the cube", async () => {
    const cube = await createCubeFolder(parent, "Pauper Cube");
    expect(cube.dir).toBe(join(parent, "pauper-cube"));
    expect(cube.config).toMatchObject({ name: "Pauper Cube", ...STARTER_CONFIG });
    expect(await readConfig(cube.paths)).toEqual(cube.config);
    expect(await readCards(cube.paths)).toEqual([]);
    expect(await readTags(cube.paths)).toEqual([]);
  });

  it("never reuses a folder or an id", async () => {
    const first = await createCubeFolder(parent, "Pauper Cube");
    const second = await createCubeFolder(parent, "Pauper Cube");
    expect(second.dir).toBe(join(parent, "pauper-cube-2"));
    expect(second.config.id).not.toBe(first.config.id);
  });

  it("rejects a blank name", async () => {
    await expect(createCubeFolder(parent, "  ")).rejects.toThrow();
  });
});

describe("openCubeFolder", () => {
  it("fills in a missing id and name once, keeping the rest", async () => {
    const dir = join(parent, "old");
    await mkdir(dir);
    await writeFile(
      join(dir, "cube.config.json"),
      JSON.stringify({ format: "winston", size: { min: 40, max: 45 } }),
    );
    const opened = await openCubeFolder(dir);
    expect(opened.config).toMatchObject({ name: "old", size: { min: 40, max: 45 } });
    const again = await openCubeFolder(dir);
    expect(again.config.id).toBe(opened.config.id);
    expect(JSON.parse(await readFile(join(dir, "cube.config.json"), "utf8"))).toEqual(
      opened.config,
    );
  });

  it("names a repo's cube/ folder after the repo", async () => {
    await mkdir(join(parent, "my-repo", "cube", "cards"), { recursive: true });
    const opened = await openCubeFolder(join(parent, "my-repo"));
    expect(opened.dir).toBe(join(parent, "my-repo", "cube"));
    expect(opened.config.name).toBe("my-repo");
  });

  it("refuses a folder that holds no cube", async () => {
    expect(await findCubeFolder(parent)).toBeUndefined();
    await expect(openCubeFolder(parent)).rejects.toThrow(/not a cube folder/u);
  });
});
