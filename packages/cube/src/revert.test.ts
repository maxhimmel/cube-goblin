import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LogEntry, LogState } from "./log.ts";
import { buildEntry } from "./log.ts";
import { planRevert } from "./revert.ts";
import { readLogState, recordEdit, revertEntries } from "./save-log.ts";
import type { CardEntry } from "./schema.ts";
import type { CubePaths } from "./store.ts";
import { cubePaths, readLog, writeCard, writeTags } from "./store.ts";

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

const base: LogState = {
  cards: [card("Shock", 1, { status: "prospect" }), card("Ponder", 2)],
  tags: [{ id: "burn", label: "Burn" }],
  board: { sections: [] },
  filters: [],
};

function entry(before: LogState, after: LogState, at: string): LogEntry {
  const built = buildEntry({
    before,
    after,
    statsBefore: {},
    statsAfter: {},
    message: {},
    source: "workbench",
    at: new Date(at),
  });
  if (!built) {
    throw new Error("expected an entry");
  }
  return built;
}

const drafted: LogState = {
  ...base,
  cards: [card("Shock", 1), card("Ponder", 2)],
};
const tagged: LogState = {
  ...drafted,
  cards: [card("Shock", 1, { tags: ["burn"] }), card("Ponder", 2)],
};
const added: LogState = {
  ...tagged,
  cards: [...tagged.cards, card("Opt", 3, { status: "prospect" })],
};

const first = entry(base, drafted, "2026-11-12T10:00:00.000Z");
const second = entry(drafted, tagged, "2026-11-12T10:01:00.000Z");
const third = entry(tagged, added, "2026-11-12T10:02:00.000Z");

describe("planRevert", () => {
  it("brings back what one entry changed", () => {
    const plan = planRevert(added, [third]);
    expect(plan.ok && plan.state.cards.map((item) => item.name)).toEqual(["Shock", "Ponder"]);
  });

  it("reverts several entries newest first, whatever order they come in", () => {
    const plan = planRevert(added, [first, third, second]);
    expect(plan.ok && plan.state.cards).toEqual(base.cards);
  });

  it("reports a conflict when a later edit touched the same card", () => {
    const plan = planRevert(tagged, [first]);
    expect(plan.ok).toBe(false);
    expect(!plan.ok && plan.conflicts).toEqual([{ entry: first.id, kind: "card", name: "Shock" }]);
  });

  it("refuses a revert that would leave the cube invalid", () => {
    const tagAdded = entry({ ...base, tags: [] }, base, "2026-11-12T09:00:00.000Z");
    const usesTag: LogState = { ...base, cards: [card("Shock", 1, { tags: ["burn"] })] };
    const plan = planRevert(usesTag, [tagAdded]);
    expect(!plan.ok && plan.problems.join()).toContain('has tag "burn"');
  });
});

describe("revertEntries", () => {
  let root: string;
  let paths: CubePaths;
  const noStats = (): Promise<Record<string, number>> => Promise.resolve({});

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "cube-revert-"));
    paths = cubePaths(root);
    await mkdir(paths.cardsDir, { recursive: true });
    await writeFile(join(root, "cube.config.json"), "{}");
    await writeTags(paths, base.tags);
    for (const item of base.cards) {
      await writeCard(paths, item);
    }
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function edit(change: (state: LogState) => Promise<unknown>): Promise<LogEntry> {
    const before = await readLogState(paths);
    await change(before);
    const logged = await recordEdit(paths, before, noStats);
    if (!logged) {
      throw new Error("expected an entry");
    }
    return logged;
  }

  it("writes the old state back, deletes added cards, and logs the revert", async () => {
    const promote = await edit(() => writeCard(paths, card("Shock", 1)));
    const add = await edit(() => writeCard(paths, card("Opt", 3, { status: "prospect" })));
    const result = await revertEntries(paths, { ids: [promote.id, add.id] }, noStats);
    expect(result.ok).toBe(true);
    expect((await readdir(paths.cardsDir)).sort()).toEqual(["ponder.json", "shock.json"]);
    expect((await readLogState(paths)).cards).toEqual([...base.cards].reverse());
    const log = await readLog(paths);
    expect(log.map((item) => item.source)).toEqual(["workbench", "workbench", "revert"]);
    expect(log[2]?.reverts).toEqual([promote.id, add.id]);
    expect(log[2]?.message.split("\n")[0]).toBe("Revert 2 entries");
  });

  it("undoes a revert by reverting it", async () => {
    const promote = await edit(() => writeCard(paths, card("Shock", 1)));
    const revert = await revertEntries(paths, { ids: [promote.id] }, noStats);
    if (!revert.ok) {
      throw new Error(revert.error);
    }
    expect(revert.entry.message.split("\n")[0]).toBe('Revert "Shock prospect→draft"');
    const again = await revertEntries(paths, { ids: [revert.entry.id] }, noStats);
    expect(again.ok).toBe(true);
    expect((await readLogState(paths)).cards.find((item) => item.name === "Shock")?.status).toBe(
      "draft",
    );
  });

  it("answers 409 on a conflict and 404 on an unknown id, writing nothing", async () => {
    const promote = await edit(() => writeCard(paths, card("Shock", 1)));
    await edit(() => writeCard(paths, card("Shock", 1, { status: "cut" })));
    const conflict = await revertEntries(paths, { ids: [promote.id] }, noStats);
    expect(conflict).toMatchObject({ ok: false, status: 409 });
    expect(await revertEntries(paths, { ids: ["nope"] }, noStats)).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(await readLog(paths)).toHaveLength(2);
  });

  it("folds back-to-back notes saves on one card into one entry", async () => {
    const shock = base.cards[0] ?? card("", 0);
    await edit(() => writeCard(paths, { ...shock, notes: "f" }));
    await edit(() => writeCard(paths, { ...shock, notes: "fine" }));
    const log = await readLog(paths);
    expect(log).toHaveLength(1);
    expect(log[0]?.changes.cards[0]?.before?.notes).toBe("");
    expect(log[0]?.changes.cards[0]?.after?.notes).toBe("fine");
    expect(log[0]?.message.split("\n")[0]).toBe("Shock notes");

    await edit(() => writeCard(paths, { ...shock, status: "draft", notes: "fine" }));
    expect(await readLog(paths)).toHaveLength(2);
  });

  it("drops the entry when notes end up as they started", async () => {
    const shock = base.cards[0] ?? card("", 0);
    await edit(() => writeCard(paths, { ...shock, notes: "x" }));
    const before = await readLogState(paths);
    await writeCard(paths, shock);
    expect(await recordEdit(paths, before, noStats)).toBeUndefined();
    expect(await readLog(paths)).toEqual([]);
  });

  it("keeps notes saves apart when an unlogged change lands between them", async () => {
    const shock = base.cards[0] ?? card("", 0);
    await edit(() => writeCard(paths, { ...shock, notes: "a" }));
    await writeCard(paths, { ...shock, notes: "a", tags: ["burn"] });
    await edit(() => writeCard(paths, { ...shock, notes: "ab", tags: ["burn"] }));
    expect(await readLog(paths)).toHaveLength(2);
  });

  it("still logs after a broken line, and names that line", async () => {
    await writeFile(paths.logFile, "{oops\n");
    await expect(readLog(paths)).rejects.toThrow(/log\.jsonl:1:/u);
    await edit(() => writeCard(paths, card("Shock", 1)));
    expect((await readFile(paths.logFile, "utf8")).split("\n")).toHaveLength(3);
  });

  it("writes nothing when the revert cannot be logged", async () => {
    const promote = await edit(() => writeCard(paths, card("Shock", 1)));
    const failing = (): Promise<Record<string, number>> => Promise.reject(new Error("offline"));
    await expect(revertEntries(paths, { ids: [promote.id] }, failing)).rejects.toThrow("offline");
    expect((await readLogState(paths)).cards.find((item) => item.name === "Shock")?.status).toBe(
      "draft",
    );
  });
});
