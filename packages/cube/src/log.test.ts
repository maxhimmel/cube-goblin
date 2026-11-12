import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { LogState, LogStats } from "./log.ts";
import { buildEntry, logChanges, logStats, parseMessage, statsTrailer } from "./log.ts";
import type { CardEntry } from "./schema.ts";
import type { StatCard } from "./stats.ts";
import { appendLog, cubePaths, readLog } from "./store.ts";

const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function card(name: string, n: number, overrides: Partial<CardEntry> = {}): CardEntry {
  return {
    name,
    oracleId: ID(n),
    status: "draft",
    tags: [],
    notes: "",
    source: { batch: "workbench", line: n, input: name },
    ...overrides,
  };
}

const before: LogState = {
  cards: [card("Shock", 1, { status: "prospect" }), card("Ponder", 2, { tags: ["cantrip"] })],
  tags: [{ id: "cantrip", label: "Cantrip", kind: "group" }],
  board: { sections: [{ id: "removal", label: "Removal", cards: [], tags: [] }] },
  filters: [],
};

const after: LogState = {
  cards: [
    card("Shock", 1, { status: "draft", tags: ["burn"] }),
    card("Ponder", 2, { tags: ["cantrip"] }),
    card("Opt", 3, { status: "prospect" }),
  ],
  tags: [
    { id: "cantrip", label: "Cantrip", kind: "group" },
    { id: "burn", label: "Burn", kind: "group" },
  ],
  board: { sections: [{ id: "removal", label: "Removal", cards: ["shock"], tags: [] }] },
  filters: [{ id: "cheap", label: "Cheap", query: "mv<=2", view: "cards" }],
};

describe("logChanges", () => {
  it("keeps only what changed, with before and after", () => {
    const changes = logChanges(before, after);
    expect(changes.cards.map((change) => [change.before?.status, change.after?.status])).toEqual([
      ["prospect", "draft"],
      [undefined, "prospect"],
    ]);
    expect(changes.tags).toEqual([{ after: { id: "burn", label: "Burn", kind: "group" } }]);
    expect(changes.sections).toHaveLength(1);
    expect(changes.filters).toHaveLength(1);
  });

  it("ignores key order and undefined fields", () => {
    const shuffled: LogState = {
      ...before,
      cards: before.cards.map((entry) => JSON.parse(JSON.stringify(entry)) as CardEntry),
    };
    expect(logChanges(before, shuffled).cards).toEqual([]);
  });
});

describe("logStats", () => {
  const stat = (overrides: Partial<StatCard>): StatCard => ({
    status: "draft",
    colors: ["R"],
    cmc: 1,
    typeLine: "Instant",
    tags: [],
    ...overrides,
  });

  it("counts statuses over the cube and the rest over the draft", () => {
    const stats = logStats(
      [
        stat({ tags: ["burn"] }),
        stat({ cmc: 3, colors: ["U", "R"], typeLine: "Creature — Wizard" }),
        stat({ status: "prospect", cmc: 9 }),
        stat({ cmc: 0, colors: [], typeLine: "Land" }),
      ],
      [{ id: "burn", label: "Burn", kind: "group" }],
    );
    expect(stats).toMatchObject({
      draft: 3,
      prospect: 1,
      cut: 0,
      "mv.avg": 2,
      "mv.1": 1,
      "mv.3": 1,
      "mv.7+": 0,
      "color.R": 1,
      "color.multicolored": 1,
      "type.creature": 1,
      "type.land": 1,
      "tag.burn": 1,
    });
  });
});

describe("message", () => {
  const statsBefore: LogStats = { draft: 1, "mv.avg": 2.5, "tag.burn": 0 };
  const statsAfter: LogStats = { draft: 2, "mv.avg": 2, "tag.burn": 1 };

  it("lists only stats that moved", () => {
    expect(statsTrailer(statsBefore, statsAfter)).toBe(
      "Stats: draft 1→2, mv.avg 2.50→2, tag.burn 0→1",
    );
    expect(statsTrailer(statsAfter, statsAfter)).toBeUndefined();
  });

  it("writes subject, body, and trailers that parse back", () => {
    const entry = buildEntry({
      before,
      after,
      statsBefore,
      statsAfter,
      message: { subject: "More red removal", body: "Red was short on cheap answers." },
      source: "workbench",
      at: new Date("2026-11-12T10:00:00.000Z"),
    });
    expect(entry?.message).toBe(
      [
        "More red removal",
        "",
        "Red was short on cheap answers.",
        "",
        "Card: Shock prospect→draft, +burn",
        "Card: Opt added as prospect",
        "Tag: burn added (group)",
        "Section: Removal +shock",
        "Filter: Cheap added",
        "Stats: draft 1→2, mv.avg 2.50→2, tag.burn 0→1",
      ].join("\n"),
    );
    const parsed = parseMessage(entry?.message ?? "");
    expect(parsed.subject).toBe("More red removal");
    expect(parsed.body).toBe("Red was short on cheap answers.");
    expect(parsed.trailers[0]).toEqual(["Card", "Shock prospect→draft, +burn"]);
    expect(entry?.id).toMatch(/^20261112t100000000z-[0-9a-f]{4}$/u);
  });

  it("falls back to a subject from the changes", () => {
    const one: LogState = { ...before, cards: [card("Shock", 1), before.cards[1] ?? card("", 0)] };
    const entry = buildEntry({
      before,
      after: one,
      statsBefore,
      statsAfter: statsBefore,
      message: {},
      source: "workbench",
    });
    expect(parseMessage(entry?.message ?? "")).toEqual({
      subject: "Shock prospect→draft",
      body: "",
      trailers: [["Card", "Shock prospect→draft"]],
    });
  });

  it("writes nothing when nothing changed", () => {
    expect(
      buildEntry({
        before,
        after: before,
        statsBefore,
        statsAfter,
        message: {},
        source: "workbench",
      }),
    ).toBeUndefined();
  });
});

describe("log file", () => {
  let root: string | undefined;
  afterEach(async () => {
    if (root !== undefined) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("appends one line per entry and reads them back in order", async () => {
    root = await mkdtemp(join(tmpdir(), "cube-log-"));
    const paths = cubePaths(root);
    await mkdir(paths.root, { recursive: true });
    expect(await readLog(paths)).toEqual([]);
    const entry = buildEntry({
      before,
      after,
      statsBefore: {},
      statsAfter: { draft: 2 },
      message: {},
      source: "workbench",
    });
    if (!entry) {
      throw new Error("expected an entry");
    }
    await appendLog(paths, entry);
    await appendLog(paths, { ...entry, id: `${entry.id}-b` });
    const text = await readFile(paths.logFile, "utf8");
    expect(text.split("\n")).toHaveLength(3);
    expect((await readLog(paths)).map((item) => item.id)).toEqual([entry.id, `${entry.id}-b`]);
  });
});
