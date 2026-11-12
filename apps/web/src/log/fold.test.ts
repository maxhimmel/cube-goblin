import type { CardEntry, Filter, LogEntry } from "@repo/cube/browser";
import { describe, expect, it } from "vitest";
import { foldCanceled, foldSummary, foldedIds, rowMatches } from "./fold.ts";

const shock: CardEntry = {
  name: "Shock",
  oracleId: "11111111-1111-4111-8111-111111111111",
  status: "draft",
  tags: [],
  notes: "",
  source: { batch: "workbench", line: 1, input: "Shock" },
};

const bolt: CardEntry = {
  ...shock,
  name: "Bolt",
  oracleId: "22222222-2222-4222-8222-222222222222",
};

const payoffs: Filter = { id: "moon", label: "Moon-Letter Payoffs", query: "mv>=3", view: "cards" };

let clock = Date.parse("2026-11-12T10:00:00.000Z");

function entry(id: string, changes: Partial<LogEntry["changes"]>, minutesLater = 1): LogEntry {
  clock += minutesLater * 60 * 1000;
  return {
    id,
    at: new Date(clock).toISOString(),
    source: "workbench",
    message: `Edit ${id}`,
    changes: { cards: [], tags: [], sections: [], filters: [], ...changes },
    stats: {},
  };
}

const cut = (card: CardEntry) => ({ before: card, after: { ...card, status: "cut" as const } });
const uncut = (card: CardEntry) => ({ before: { ...card, status: "cut" as const }, after: card });
const view = (from: string, to: string) => ({
  before: { ...payoffs, view: from },
  after: { ...payoffs, view: to },
});

describe("foldCanceled", () => {
  it("folds a run of edits that ends where it started", () => {
    const rows = foldCanceled([
      entry("a", { cards: [cut(bolt)] }),
      entry("b", { filters: [view("cards", "curve")] }),
      entry("c", { filters: [view("curve", "types")] }),
      entry("d", { filters: [view("types", "cards")] }),
      entry("e", { cards: [cut(shock)] }),
    ]);
    expect(
      rows.map((row) => (row.kind === "fold" ? row.entries.map((e) => e.id) : row.entry.id)),
    ).toEqual(["a", ["b", "c", "d"], "e"]);
    expect(foldedIds(rows)).toEqual(new Set(["b", "c", "d"]));
  });

  it("folds interleaved edits only once every item is back", () => {
    const rows = foldCanceled([
      entry("a", { cards: [cut(shock)] }),
      entry("b", { cards: [cut(bolt)] }),
      entry("c", { cards: [uncut(shock)] }),
      entry("d", { cards: [uncut(bolt)] }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("fold");
  });

  it("keeps edits that leave something changed", () => {
    const rows = foldCanceled([
      entry("a", { cards: [cut(shock)] }),
      entry("b", { cards: [cut(bolt)] }),
    ]);
    expect(rows.map((row) => row.kind)).toEqual(["entry", "entry"]);
  });

  it("does not fold across a long pause", () => {
    const rows = foldCanceled([
      entry("a", { cards: [cut(shock)] }),
      entry("b", { cards: [uncut(shock)] }, 31),
    ]);
    expect(rows.map((row) => row.kind)).toEqual(["entry", "entry"]);
  });
});

describe("fold rows", () => {
  const rows = foldCanceled([
    entry("a", { cards: [cut(shock)] }),
    entry("b", { cards: [uncut(shock)] }),
  ]);
  const [fold] = rows;

  it("summarize what they touched", () => {
    expect(fold?.kind === "fold" && foldSummary(fold)).toBe("2 edits that cancel out · Shock");
  });

  it("match the log filter by any entry or touched name", () => {
    expect(fold && rowMatches(fold, "shock")).toBe(true);
    expect(fold && rowMatches(fold, "edit b")).toBe(true);
    expect(fold && rowMatches(fold, "bolt")).toBe(false);
  });
});
