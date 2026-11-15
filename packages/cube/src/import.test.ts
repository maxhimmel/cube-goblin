import { describe, expect, it } from "vitest";
import { parseList, toExportCards } from "./formats/index.ts";
import { planImport } from "./import.ts";
import type { CardEntry } from "./schema.ts";

const ORACLE = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const existing: CardEntry = {
  name: "Abrade",
  oracleId: ORACLE(1),
  status: "draft",
  tags: [],
  notes: "",
  source: { batch: "b", line: 1, input: "Abrade" },
};

describe("planImport", () => {
  const { rows } = parseList(
    "1x Abrade (soa) 37 [Removal]\n2x Sol Ring (c21) 263 [Ramp,removal]\n1x Ponder [Maybeboard{noDeck},Draw]\n1x Ponder\nTokens\n1x Treasure\n",
  );
  const [abrade, sol, ponder, ponderAgain, treasure] = rows;
  if (!abrade || !sol || !ponder || !ponderAgain || !treasure) {
    throw new Error("rows");
  }
  const matches = [
    { row: abrade, oracleId: ORACLE(1), name: "Abrade" },
    { row: sol, oracleId: ORACLE(2), name: "Sol Ring", printing: ORACLE(20) },
    { row: ponder, oracleId: ORACLE(3), name: "Ponder" },
    { row: ponderAgain, oracleId: ORACLE(3), name: "Ponder" },
    { row: treasure, oracleId: ORACLE(4), name: "Treasure" },
  ];
  const plan = planImport({
    matches,
    existing: [existing],
    tags: [{ id: "removal", label: "Removal" }],
    batch: "archidekt",
  });

  it("adds new cards with statuses from their boards", () => {
    expect(plan.cards.map((card) => [card.name, card.status, card.tags, card.printing])).toEqual([
      ["Sol Ring", "draft", ["ramp", "removal"], ORACLE(20)],
      ["Ponder", "prospect", ["draw"], undefined],
    ]);
    expect(plan.cards[0]?.source).toEqual({ batch: "archidekt", line: 2, input: sol.input });
  });

  it("reuses known tags by label and makes the rest", () => {
    expect(plan.newTags).toEqual([
      { id: "ramp", label: "Ramp" },
      { id: "draw", label: "Draw" },
    ]);
  });

  it("skips cards already in the cube, repeats, and tokens, and warns about copies", () => {
    expect(plan.skipped.map((skip) => skip.reason)).toEqual([
      "Abrade is already in the cube",
      "Ponder is already on line 3",
      "tokens is skipped",
    ]);
    expect(plan.warnings.map((warning) => warning.message)).toEqual([
      "2 copies of Sol Ring; a cube is singleton, so 1 is kept",
    ]);
  });

  it("lets the user remap a board", () => {
    const remapped = planImport({
      matches,
      existing: [],
      tags: [],
      batch: "x",
      boards: { maybe: "draft", main: "skip" },
    });
    expect(remapped.cards.map((card) => [card.name, card.status])).toEqual([["Ponder", "draft"]]);
  });
});

describe("toExportCards", () => {
  it("labels tags and carries the shown printing", () => {
    const cards = toExportCards(
      [{ ...existing, tags: ["burn"], notes: "n" }],
      [{ id: "burn", label: "Burn" }],
      () => ({ id: "p", layout: "normal", set: "soa", collector_number: "37", mtgo_id: 5 }),
    );
    expect(cards).toEqual([
      {
        name: "Abrade",
        layout: "normal",
        status: "draft",
        tags: ["Burn"],
        notes: "n",
        set: "soa",
        collectorNumber: "37",
        printingId: "p",
        mtgoId: 5,
      },
    ]);
  });
});
