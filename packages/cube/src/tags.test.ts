import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { CubePaths } from "./store.ts";
import { cubePaths, readTags } from "./store.ts";
import { changeTag, createTag } from "./tags.ts";

let paths: CubePaths;

beforeEach(async () => {
  paths = cubePaths(await mkdtemp(join(tmpdir(), "cube-tags-")));
  await mkdir(paths.root, { recursive: true });
  await writeFile(paths.tagsFile, JSON.stringify({ tags: [] }));
});

describe("createTag", () => {
  it("adds a tag with an id derived from its label", async () => {
    const result = await createTag(paths, { label: "Go Wide", kind: "archetype" });
    const tag = { id: "go-wide", label: "Go Wide", kind: "archetype" };
    expect(result).toEqual({ ok: true, tag });
    expect(await readTags(paths)).toEqual([tag]);
    expect(await readFile(paths.tagsFile, "utf8")).toMatch(/\n$/u);
  });

  it("refuses a second tag with the same id", async () => {
    await createTag(paths, { label: "Removal", kind: "group" });
    expect(await createTag(paths, { label: "removal!", kind: "archetype" })).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(await readTags(paths)).toHaveLength(1);
  });

  it("rejects blank labels, labels with no letters, and unknown kinds", async () => {
    for (const input of [
      { label: "  ", kind: "group" },
      { label: "!!", kind: "group" },
      { label: "Ramp", kind: "theme" },
    ]) {
      expect(await createTag(paths, input)).toMatchObject({ ok: false, status: 400 });
    }
    expect(await readTags(paths)).toEqual([]);
  });
});

describe("changeTag", () => {
  it("renames and re-kinds a tag while keeping its id", async () => {
    await createTag(paths, { label: "Removal", kind: "group" });
    const result = await changeTag(paths, "removal", { label: "Hard removal" });
    expect(result).toEqual({
      ok: true,
      tag: { id: "removal", label: "Hard removal", kind: "group" },
    });
    await changeTag(paths, "removal", { kind: "archetype" });
    expect(await readTags(paths)).toEqual([
      { id: "removal", label: "Hard removal", kind: "archetype" },
    ]);
  });

  it("refuses labels another tag already uses, ignoring case", async () => {
    await createTag(paths, { label: "Removal", kind: "group" });
    await createTag(paths, { label: "Burn", kind: "group" });
    expect(await changeTag(paths, "burn", { label: "removal" })).toMatchObject({ status: 409 });
    await changeTag(paths, "removal", { label: "Hard removal" });
    expect(await createTag(paths, { label: "hard REMOVAL", kind: "group" })).toMatchObject({
      status: 409,
    });
    expect(await changeTag(paths, "removal", { label: "HARD removal" })).toMatchObject({
      ok: true,
    });
  });

  it("returns 404 for an unknown tag and 400 for a bad change", async () => {
    expect(await changeTag(paths, "nope", { label: "x" })).toMatchObject({ status: 404 });
    await createTag(paths, { label: "Removal", kind: "group" });
    expect(await changeTag(paths, "removal", { id: "other" })).toMatchObject({ status: 400 });
    expect(await changeTag(paths, "removal", { label: "" })).toMatchObject({ status: 400 });
  });
});
