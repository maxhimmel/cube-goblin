import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  linkTag,
  moveCard,
  putCard,
  restoreSection,
  takeCard,
  unlinkTag,
  validateBoard,
} from "./board.ts";
import { loadBoard, saveBoard } from "./save-board.ts";
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
const burn: Tag = { id: "burn", label: "Burn" };

const board: Board = {
  sections: [
    { id: "a", label: "Burn", cards: ["shock"], tags: [] },
    { id: "b", label: "Spells", cards: [], tags: [] },
  ],
};

describe("section edits", () => {
  it("puts a card once, takes it out, and moves it between sections", () => {
    expect(putCard(board, "a", "shock")).toEqual(board);
    expect(putCard(board, "b", "shock").sections.map((section) => section.cards)).toEqual([
      ["shock"],
      ["shock"],
    ]);
    expect(takeCard(board, "a", "shock").sections[0]?.cards).toEqual([]);
    expect(moveCard(board, "a", "b", "shock").sections.map((section) => section.cards)).toEqual([
      [],
      ["shock"],
    ]);
    expect(moveCard(board, "a", "a", "shock")).toBe(board);
    expect(putCard(board, "a", "shock")).toBe(board);
    expect(takeCard(board, "b", "shock")).toBe(board);
  });

  it("links several tags once each and unlinks them", () => {
    const linked = linkTag(linkTag(linkTag(board, "a", "burn"), "a", "removal"), "a", "burn");
    expect(linked.sections[0]?.tags).toEqual(["burn", "removal"]);
    expect(unlinkTag(linked, "a", "burn").sections[0]?.tags).toEqual(["removal"]);
    expect(unlinkTag(board, "a", "burn")).toBe(board);
  });

  it("puts a deleted section back where it was", () => {
    const [first] = board.sections;
    if (!first) {
      throw new Error("fixture has no section");
    }
    const without = { sections: board.sections.slice(1) };
    expect(restoreSection(without, first, 0)).toEqual(board);
    expect(restoreSection(board, first, 0)).toBe(board);
  });
});

describe("validateBoard", () => {
  it("accepts a board of known cards and tags", () => {
    const linked = { id: "a", label: "Burn", cards: ["shock"], tags: ["burn"] };
    expect(validateBoard({ sections: [linked] }, [shock], [burn])).toEqual([]);
  });

  it("names unknown cards, repeated cards, unknown tags, and duplicate sections", () => {
    const problems = validateBoard(
      {
        sections: [
          {
            id: "a",
            label: "One",
            cards: ["shock", "shock", "bolt"],
            tags: ["ramp", "burn", "burn"],
          },
          { id: "a", label: "Two", cards: [], tags: [] },
        ],
      },
      [shock],
      [burn],
    );
    expect(problems).toEqual([
      'Section "One" holds "bolt", which is not in cube/cards',
      'Section "One" lists a card more than once',
      'Section "One" links tag "ramp", which is not in tags.json',
      'Section "One" links a tag more than once',
      'Duplicate section "a" in board.json',
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
    expect(await readBoard(paths)).toEqual({ sections: [] });
  });

  it("writes a valid board and reads it back", async () => {
    expect(await saveBoard(paths, board)).toEqual({ ok: true, board });
    expect(await readBoard(paths)).toEqual(board);
    expect(await readFile(paths.boardFile, "utf8")).toMatch(/\n$/u);
  });

  it("drops cards and tags that no longer exist instead of refusing the save", async () => {
    const stale = {
      sections: [{ id: "a", label: "x", cards: ["bolt", "shock"], tags: ["ramp", "burn"] }],
    };
    const saved = { sections: [{ id: "a", label: "x", cards: ["shock"], tags: ["burn"] }] };
    expect(await saveBoard(paths, stale)).toEqual({ ok: true, board: saved });
    await writeFile(paths.boardFile, JSON.stringify(stale));
    expect(await loadBoard(paths)).toEqual(saved);
  });

  it("reads a section's old single tag as a list of one", async () => {
    await writeFile(
      paths.boardFile,
      JSON.stringify({
        sections: [
          { id: "a", label: "x", cards: [], tag: "burn" },
          { id: "b", label: "y", cards: [] },
        ],
      }),
    );
    expect(await loadBoard(paths)).toEqual({
      sections: [
        { id: "a", label: "x", cards: [], tags: ["burn"] },
        { id: "b", label: "y", cards: [], tags: [] },
      ],
    });
  });

  it("refuses a malformed board", async () => {
    for (const input of [
      { sections: [{ id: "A B", label: "x", cards: [] }] },
      { sections: [{ id: "a", label: " ", cards: [] }] },
      {
        sections: [
          { id: "a", label: "x", cards: [] },
          { id: "a", label: "y", cards: [] },
        ],
      },
    ]) {
      expect(await saveBoard(paths, input)).toMatchObject({ ok: false, status: 400 });
    }
    expect(await readBoard(paths)).toEqual({ sections: [] });
  });
});
