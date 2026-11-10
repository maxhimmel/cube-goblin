import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { moveCard, putCard, takeCard, validateBoard } from "./board.ts";
import { saveBoard } from "./save-board.ts";
import type { Board, CardEntry, Tag } from "./schema.ts";
import type { CubePaths } from "./store.ts";
import { cubePaths, readBoard, writeCard } from "./store.ts";

const shock: CardEntry = {
  name: "Shock",
  oracleId: "8b4b6b0e-0000-4000-8000-000000000001",
  status: "draft",
  tags: [],
  notes: "",
  source: { batch: "test", line: 1, input: "Shock" },
};
const opt: CardEntry = { ...shock, name: "Opt", oracleId: "8b4b6b0e-0000-4000-8000-000000000002" };
const burn: Tag = { id: "burn", label: "Burn", kind: "group" };

const board: Board = {
  bins: [
    { id: "a", label: "Burn", cards: ["shock"] },
    { id: "b", label: "Spells", cards: [] },
  ],
};

describe("bin edits", () => {
  it("puts a card once, takes it out, and moves it between bins", () => {
    expect(putCard(board, "a", "shock")).toEqual(board);
    expect(putCard(board, "b", "shock").bins.map((bin) => bin.cards)).toEqual([
      ["shock"],
      ["shock"],
    ]);
    expect(takeCard(board, "a", "shock").bins[0]?.cards).toEqual([]);
    expect(moveCard(board, "a", "b", "shock").bins.map((bin) => bin.cards)).toEqual([
      [],
      ["shock"],
    ]);
    expect(moveCard(board, "a", "a", "shock")).toBe(board);
  });
});

describe("validateBoard", () => {
  it("accepts a board of known cards and tags", () => {
    const linked = { id: "a", label: "Burn", cards: ["shock"], tag: "burn" };
    expect(validateBoard({ bins: [linked] }, [shock], [burn])).toEqual([]);
  });

  it("names unknown cards, repeated cards, unknown tags, and duplicate bins", () => {
    const problems = validateBoard(
      {
        bins: [
          { id: "a", label: "One", cards: ["shock", "shock", "bolt"], tag: "ramp" },
          { id: "a", label: "Two", cards: [] },
        ],
      },
      [shock],
      [burn],
    );
    expect(problems).toEqual([
      'Bin "One" holds "bolt", which is not in cube/cards',
      'Bin "One" lists a card more than once',
      'Bin "One" links tag "ramp", which is not in tags.json',
      'Duplicate bin "a" in board.json',
    ]);
  });
});

describe("saveBoard", () => {
  let paths: CubePaths;

  beforeEach(async () => {
    paths = cubePaths(await mkdtemp(join(tmpdir(), "cube-board-")));
    await mkdir(paths.root, { recursive: true });
    await writeFile(paths.tagsFile, JSON.stringify({ tags: [burn] }));
    await writeCard(paths, shock);
    await writeCard(paths, opt);
  });

  it("reads an empty board when the file is missing", async () => {
    expect(await readBoard(paths)).toEqual({ bins: [] });
  });

  it("writes a valid board and reads it back", async () => {
    expect(await saveBoard(paths, board)).toEqual({ ok: true, board });
    expect(await readBoard(paths)).toEqual(board);
    expect(await readFile(paths.boardFile, "utf8")).toMatch(/\n$/u);
  });

  it("refuses a malformed board or one that points at missing cards", async () => {
    for (const input of [
      { bins: [{ id: "A B", label: "x", cards: [] }] },
      { bins: [{ id: "a", label: " ", cards: [] }] },
      { bins: [{ id: "a", label: "x", cards: ["bolt"] }] },
    ]) {
      expect(await saveBoard(paths, input)).toMatchObject({ ok: false, status: 400 });
    }
    expect(await readBoard(paths)).toEqual({ bins: [] });
  });
});
