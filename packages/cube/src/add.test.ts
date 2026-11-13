import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { CardLookup } from "./add.ts";
import { addCard } from "./add.ts";
import { parseBatch } from "./parse.ts";
import type { CardEntry } from "./schema.ts";
import type { CubePaths } from "./store.ts";
import { cubePaths, readCards, writeCard } from "./store.ts";

const BOLT_ID = "8b4b6b0e-0000-4000-8000-0000000000b1";
const OPT_ID = "8b4b6b0e-0000-4000-8000-0000000000b2";

const shock: CardEntry = {
  name: "Shock",
  oracleId: "8b4b6b0e-0000-4000-8000-000000000001",
  status: "prospect",
  tags: ["burn"],
  notes: "fine",
  source: { batch: "test", line: 1, input: "Shock" },
};

const found = new Map([
  [BOLT_ID, { name: "Lightning Bolt", functionTags: ["burn", "removal"] }],
  [OPT_ID, { name: "Opt", functionTags: [] }],
  [shock.oracleId, { name: "Shock", functionTags: ["burn"] }],
]);
const lookup: CardLookup = (id) => Promise.resolve(found.get(id));

let paths: CubePaths;

async function card(slug: string): Promise<unknown> {
  return JSON.parse(await readFile(join(paths.cardsDir, `${slug}.json`), "utf8"));
}

beforeEach(async () => {
  paths = cubePaths(await mkdtemp(join(tmpdir(), "cube-add-")));
  await mkdir(paths.root, { recursive: true });
  await writeFile(paths.tagsFile, JSON.stringify({ tags: [{ id: "burn", label: "Burn" }] }));
  await writeCard(paths, shock);
});

describe("addCard", () => {
  it("writes the card and a workbench batch line it points to", async () => {
    const first = await addCard(paths, { oracleId: BOLT_ID, status: "draft" }, lookup);
    const second = await addCard(paths, { oracleId: OPT_ID, status: "prospect" }, lookup);
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    expect(await card("opt")).toEqual({
      name: "Opt",
      oracleId: OPT_ID,
      status: "prospect",
      tags: [],
      notes: "",
      source: { batch: "workbench", line: 2, input: "[  ] Opt" },
    });
    const batch = parseBatch(await readFile(paths.workbenchBatch, "utf8"));
    expect(batch.map((entry) => [entry.line, entry.name])).toEqual([
      [1, "Lightning Bolt"],
      [2, "Opt"],
    ]);
  });

  it("tags a new card with its functions that are in the vocabulary", async () => {
    await addCard(paths, { oracleId: BOLT_ID, status: "draft" }, lookup);
    expect(await card("lightning-bolt")).toMatchObject({ tags: ["burn"] });
  });

  it("swaps a card: the old one becomes cut and keeps its notes", async () => {
    const result = await addCard(
      paths,
      {
        oracleId: BOLT_ID,
        status: "prospect",
        replaces: "shock",
        copyTags: true,
      },
      lookup,
    );
    expect(result).toMatchObject({ ok: true });
    expect(await card("shock")).toEqual({ ...shock, status: "cut" });
    expect(await card("lightning-bolt")).toMatchObject({
      status: "prospect",
      tags: ["burn"],
      notes: "",
    });
  });

  it("rejects a card already in the cube and writes nothing", async () => {
    const result = await addCard(paths, { oracleId: shock.oracleId, status: "draft" }, lookup);
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(await readCards(paths)).toEqual([shock]);
    await expect(readFile(paths.workbenchBatch, "utf8")).rejects.toThrow();
  });

  it("returns 404 for unknown cards", async () => {
    const unknownOracle = "8b4b6b0e-0000-4000-8000-0000000000ff";
    expect(
      await addCard(paths, { oracleId: unknownOracle, status: "draft" }, lookup),
    ).toMatchObject({ ok: false, status: 404 });
    expect(
      await addCard(paths, { oracleId: BOLT_ID, status: "draft", replaces: "bolt" }, lookup),
    ).toMatchObject({ ok: false, status: 404 });
  });

  it("rejects swapping out a card that is already cut", async () => {
    await writeCard(paths, { ...shock, status: "cut" });
    const result = await addCard(
      paths,
      { oracleId: BOLT_ID, status: "draft", replaces: "shock" },
      lookup,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(await readCards(paths)).toHaveLength(1);
  });

  it("does not look up a card that is already in the cube", async () => {
    let lookups = 0;
    const counting: CardLookup = (id) => {
      lookups += 1;
      return lookup(id);
    };
    await addCard(paths, { oracleId: shock.oracleId, status: "draft" }, counting);
    expect(lookups).toBe(0);
  });

  it("rejects a section field", async () => {
    const result = await addCard(
      paths,
      { oracleId: BOLT_ID, status: "prospect", section: "pirates" },
      lookup,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});
