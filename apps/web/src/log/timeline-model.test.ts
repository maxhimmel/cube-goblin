import type { LogEntry } from "@repo/cube/browser";
import { describe, expect, it } from "vitest";
import {
  hasWhy,
  statColor,
  statGroupOf,
  statLabel,
  setStats,
  statOptions,
  statRange,
  timelinePoints,
  toggleStat,
} from "./timeline-model.ts";

function entry(id: string, message: string, stats: Record<string, number>): LogEntry {
  return {
    id,
    at: "2026-11-12T10:00:00.000Z",
    source: "workbench",
    message,
    changes: { cards: [], tags: [], sections: [], filters: [] },
    stats,
  };
}

const entries = [
  entry("a", "Shock +burn\n\nCard: Shock +burn", { draft: 10, "mv.1": 3, "tag.burn": 2 }),
  entry("b", "Lab: +1 −0\n\nMore reach.\n\nCard: Bolt prospect→draft", {
    draft: 11,
    "mv.avg": 2.5,
    "color.R": 4,
  }),
];

describe("statGroupOf and statLabel", () => {
  it("groups keys by prefix and strips it from the label", () => {
    expect(statGroupOf("draft")).toBe("Counts");
    expect(statGroupOf("mv.7+")).toBe("Curve");
    expect(statGroupOf("tag.card-draw")).toBe("Tags");
    expect(statLabel("tag.card-draw")).toBe("card-draw");
    expect(statLabel("mv.avg")).toBe("average");
    expect(statLabel("prospect")).toBe("prospect");
  });
});

describe("statOptions", () => {
  it("lists every key any entry has, grouped in log order", () => {
    const options = statOptions(entries);
    expect(options.get("Counts")?.map((option) => option.key)).toEqual(["draft"]);
    expect(options.get("Curve")?.map((option) => option.key)).toEqual(["mv.1", "mv.avg"]);
    expect(options.get("Colors")?.map((option) => option.key)).toEqual(["color.R"]);
    expect(options.get("Tags")?.map((option) => option.label)).toEqual(["burn"]);
    expect(options.get("Types")).toEqual([]);
  });
});

describe("timelinePoints", () => {
  it("emits one point per entry and stat, zero when the entry lacks it", () => {
    const points = timelinePoints(entries, ["draft", "tag.burn"]);
    expect(points.map((point) => [point.entry, point.index, point.key, point.value])).toEqual([
      ["a", 0, "draft", 10],
      ["a", 0, "tag.burn", 2],
      ["b", 1, "draft", 11],
      ["b", 1, "tag.burn", 0],
    ]);
  });

  it("carries the subject and whether the entry has a why", () => {
    const [first, second] = timelinePoints(entries, ["draft"]);
    expect(first).toMatchObject({ subject: "Shock +burn", why: false });
    expect(second).toMatchObject({ subject: "Lab: +1 −0", why: true });
    expect(entries.map(hasWhy)).toEqual([false, true]);
  });
});

describe("toggleStat", () => {
  it("adds a missing key at the end and removes a present one", () => {
    expect(toggleStat(["draft"], "mv.avg")).toEqual(["draft", "mv.avg"]);
    expect(toggleStat(["draft", "mv.avg"], "draft")).toEqual(["mv.avg"]);
  });
});

describe("statColor", () => {
  it("paints colors in mana colors and other stats in palette order", () => {
    const keys = ["draft", "color.R", "mv.avg"];
    expect(statColor("color.R", keys)).toBe("var(--mana-r)");
    expect(statColor("draft", keys)).toBe("var(--chart-curve)");
    expect(statColor("mv.avg", keys)).toBe("var(--chart-functions)");
  });
});

describe("timelinePoints in change mode", () => {
  it("plots each stat as its change since the first entry and keeps the raw value", () => {
    const points = timelinePoints(entries, ["draft", "color.R"], "change");
    expect(points.map((point) => [point.key, point.value, point.raw])).toEqual([
      ["draft", 0, 10],
      ["color.R", 0, 0],
      ["draft", 1, 11],
      ["color.R", 4, 4],
    ]);
  });
});

describe("setStats", () => {
  it("turns a set of stats on at the end or off, keeping the rest in order", () => {
    expect(setStats(["draft", "mv.1"], ["mv.1", "mv.2", "mv.3"], true)).toEqual([
      "draft",
      "mv.1",
      "mv.2",
      "mv.3",
    ]);
    expect(setStats(["draft", "mv.1", "mv.2"], ["mv.1", "mv.2", "mv.3"], false)).toEqual(["draft"]);
  });
});

describe("statRange", () => {
  const options = ["mv.1", "mv.2", "mv.3", "mv.4"].map((key) => ({ key, label: key }));
  it("spans the options between two keys in either direction", () => {
    expect(statRange(options, "mv.2", "mv.4")).toEqual(["mv.2", "mv.3", "mv.4"]);
    expect(statRange(options, "mv.4", "mv.2")).toEqual(["mv.2", "mv.3", "mv.4"]);
  });

  it("falls back to the clicked key when the anchor is in another group", () => {
    expect(statRange(options, "draft", "mv.3")).toEqual(["mv.3"]);
  });
});
