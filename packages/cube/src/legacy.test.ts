import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateLegacyCube } from "./legacy.ts";
import { cubePaths, readBoard, readCards, readTags } from "./store.ts";

describe("migrateLegacyCube", () => {
  let root: string | undefined;
  afterEach(async () => {
    if (root !== undefined) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("brings card sections, board bins, and a missing tags file to today's format", async () => {
    root = await mkdtemp(join(tmpdir(), "cube-legacy-"));
    const paths = cubePaths(root);
    await mkdir(paths.cardsDir, { recursive: true });
    const base = {
      oracleId: "00000000-0000-4000-8000-000000000001",
      status: "draft",
      tags: [],
      source: { batch: "batch-001", line: 1, input: "x" },
    };
    await writeFile(
      join(paths.cardsDir, "shock.json"),
      JSON.stringify({ ...base, name: "Shock", section: "pirates", notes: "" }),
    );
    await writeFile(
      join(paths.cardsDir, "opt.json"),
      JSON.stringify({
        ...base,
        name: "Opt",
        oracleId: "00000000-0000-4000-8000-000000000002",
        section: "merfolk",
        notes: "cheap",
      }),
    );
    await writeFile(
      join(paths.root, "sections.json"),
      JSON.stringify({ sections: [{ id: "pirates", label: "Pirates", header: "" }] }),
    );
    await writeFile(
      paths.boardFile,
      JSON.stringify({ bins: [{ id: "removal", label: "Removal", cards: ["shock"] }] }),
    );
    await migrateLegacyCube(paths);
    const cards = await readCards(paths);
    expect(cards.map((card) => [card.name, card.notes])).toEqual([
      ["Opt", "cheap\nDeck: merfolk"],
      ["Shock", "Deck: Pirates"],
    ]);
    expect(await readBoard(paths)).toEqual({
      sections: [{ id: "removal", label: "Removal", cards: ["shock"], tags: [] }],
    });
    expect(await readTags(paths)).toEqual([]);
  });
});
