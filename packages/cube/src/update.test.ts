import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { CardEntry } from "./schema.ts";
import type { CubePaths } from "./store.ts";
import { cubePaths, writeCard } from "./store.ts";
import { updateCard } from "./update.ts";

const shock: CardEntry = {
  name: "Shock",
  oracleId: "8b4b6b0e-0000-4000-8000-000000000001",
  status: "draft",
  tags: [],
  notes: "",
  source: { batch: "test", line: 1, input: "Shock" },
};

const opt: CardEntry = { ...shock, name: "Opt", oracleId: "8b4b6b0e-0000-4000-8000-000000000002" };

let paths: CubePaths;

async function onDisk(slug: string): Promise<unknown> {
  return JSON.parse(await readFile(join(paths.cardsDir, `${slug}.json`), "utf8"));
}

beforeEach(async () => {
  paths = cubePaths(await mkdtemp(join(tmpdir(), "cube-update-")));
  await mkdir(paths.root, { recursive: true });
  await writeFile(
    paths.sectionsFile,
    JSON.stringify({ sections: [{ id: "pirates", label: "Pirates", header: "x" }] }),
  );
  await writeCard(paths, shock);
  await writeCard(paths, opt);
});

describe("updateCard", () => {
  it("writes a valid edit to the card file", async () => {
    const edited = { ...shock, status: "cut", notes: "too narrow", section: "pirates" };
    expect(await updateCard(paths, "shock", edited)).toEqual({ ok: true, card: edited });
    expect(await onDisk("shock")).toEqual(edited);
  });

  it("rejects input that fails the schema", async () => {
    const result = await updateCard(paths, "shock", { ...shock, status: "maybe" });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(await onDisk("shock")).toEqual(shock);
  });

  it("rejects a name that does not match the slug", async () => {
    const result = await updateCard(paths, "shock", { ...shock, name: "Lightning Bolt" });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects changes to a card's identity", async () => {
    for (const change of [
      { name: "shock" },
      { oracleId: "8b4b6b0e-0000-4000-8000-000000000009" },
      { source: { batch: "other", line: 2, input: "Shock" } },
    ]) {
      const result = await updateCard(paths, "shock", { ...shock, ...change });
      expect(result).toMatchObject({ ok: false, status: 400 });
    }
    expect(await onDisk("shock")).toEqual(shock);
  });

  it("leaves no temp files behind", async () => {
    await updateCard(paths, "shock", { ...shock, notes: "x" });
    expect((await readdir(paths.cardsDir)).sort()).toEqual(["opt.json", "shock.json"]);
  });

  it("returns 404 for an unknown card", async () => {
    const result = await updateCard(paths, "bolt", { ...shock, name: "Bolt" });
    expect(result).toMatchObject({ ok: false, status: 404 });
  });

  it("rejects edits that break cube rules", async () => {
    const unknownSection = await updateCard(paths, "shock", { ...shock, section: "elves" });
    expect(unknownSection).toMatchObject({ ok: false, status: 400 });
    expect(await onDisk("shock")).toEqual(shock);
    expect(await onDisk("opt")).toEqual(opt);
  });
});
