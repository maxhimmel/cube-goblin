import { describe, expect, it } from "vitest";
import type { Commit } from "./backfill.ts";
import { backfill, commitMessage, gitSha } from "./backfill.ts";
import type { LogEntry, LogState } from "./log.ts";
import { buildEntry, parseMessage } from "./log.ts";
import type { CardEntry } from "./schema.ts";

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

function state(cards: CardEntry[]): LogState {
  return { cards, tags: [], board: { sections: [] }, filters: [] };
}

const statsOf = (value: LogState): Promise<Record<string, number>> =>
  Promise.resolve({ draft: value.cards.filter((item) => item.status === "draft").length });

const empty = state([]);
const imported = state([card("Shock", 1), card("Opt", 2)]);
const cutOpt = state([card("Shock", 1), card("Opt", 2, { status: "cut" })]);
const tagged = state([card("Shock", 1, { tags: ["burn"] }), card("Opt", 2, { status: "cut" })]);

const commits: Commit[] = [
  {
    sha: "aaa",
    at: "2026-11-08T12:00:00-08:00",
    message: "feat(cube): import the first batch\n\nTwo cards.\n\nCo-Authored-By: Someone <a@b.c>",
    before: empty,
    after: imported,
  },
  {
    sha: "bbb",
    at: "2026-11-09T12:00:00-08:00",
    message: "chore(cube): save workbench edits",
    before: imported,
    after: cutOpt,
  },
  {
    sha: "ccc",
    at: "2026-11-10T12:00:00-08:00",
    message: "refactor(cube)!: new format",
    before: cutOpt,
    after: cutOpt,
  },
  {
    sha: "ddd",
    at: "2026-11-11T12:00:00-08:00",
    message: "chore(cube): tag Shock",
    before: cutOpt,
    after: tagged,
  },
];

function liveEntry(): LogEntry {
  const entry = buildEntry({
    before: cutOpt,
    after: tagged,
    statsBefore: { draft: 1 },
    statsAfter: { draft: 1 },
    message: { subject: "Shock +burn" },
    source: "workbench",
    at: new Date("2026-11-11T11:00:00-08:00"),
  });
  if (!entry) {
    throw new Error("expected an entry");
  }
  return entry;
}

describe("commitMessage", () => {
  it("drops the conventional prefix and the commit's trailers", () => {
    expect(commitMessage(commits[0]?.message ?? "")).toEqual({
      subject: "Import the first batch",
      body: "Two cards.",
    });
  });
});

describe("backfill", () => {
  it("writes one entry per commit that changed the cube, before the live entries", async () => {
    const live = liveEntry();
    const { log, added } = await backfill(commits, [live], statsOf);
    expect(added.map((entry) => gitSha(entry))).toEqual(["aaa", "bbb"]);
    expect(log.map((entry) => entry.id)).toEqual([...added.map((entry) => entry.id), live.id]);
    const [first, second] = added;
    expect(first?.source).toBe("git");
    expect(first?.at).toBe("2026-11-08T20:00:00.000Z");
    expect(first?.stats).toEqual({ draft: 2 });
    const parsed = parseMessage(first?.message ?? "");
    expect(parsed.subject).toBe("Import the first batch");
    expect(parsed.body).toBe("Two cards.");
    expect(parsed.trailers).toContainEqual(["Source", "git aaa"]);
    expect(parsed.trailers).not.toContainEqual(["Co-Authored-By", "Someone <a@b.c>"]);
    expect(second?.changes.cards.map((change) => change.after?.status)).toEqual(["cut"]);
  });

  it("leaves out changes a live entry already records", async () => {
    const { added } = await backfill(commits, [liveEntry()], statsOf);
    expect(added.some((entry) => gitSha(entry) === "ddd")).toBe(false);
    const { added: without } = await backfill(commits, [], statsOf);
    expect(without.map((entry) => gitSha(entry))).toEqual(["aaa", "bbb", "ddd"]);
  });

  it("changes nothing on a second run", async () => {
    const first = await backfill(commits, [liveEntry()], statsOf);
    const second = await backfill(commits, first.log, statsOf);
    expect(second.added).toEqual([]);
    expect(second.log).toEqual(first.log);
  });
});
