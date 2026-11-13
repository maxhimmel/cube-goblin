import type { LogEntry } from "@repo/cube/browser";
import { CURRENT, entryPoint } from "@repo/cube/browser";
import { describe, expect, it } from "vitest";
import { markerPosition, rangeOf } from "./points.ts";

function entry(id: string, at: string): LogEntry {
  return {
    id,
    at,
    source: "workbench",
    message: id,
    changes: { cards: [], tags: [], sections: [], filters: [] },
    stats: {},
  };
}

const entries = [
  entry("a", "2026-11-10T10:00:00.000Z"),
  entry("b", "2026-11-11T10:00:00.000Z"),
  entry("c", "2026-11-12T10:00:00.000Z"),
];
const markers = [{ id: "v1", label: "v1", at: "2026-11-11T12:00:00.000Z" }];

describe("rangeOf", () => {
  it("takes the edits from before one entry through after another", () => {
    expect(rangeOf(entries, markers, entryPoint("before", "b"), entryPoint("after", "c"))).toEqual(
      new Set(["b", "c"]),
    );
    expect(rangeOf(entries, markers, entryPoint("after", "a"), entryPoint("before", "b"))).toEqual(
      new Set(),
    );
  });

  it("places a version between the entries around it and runs to now", () => {
    expect(markerPosition(entries, "2026-11-11T12:00:00.000Z")).toBe(1.5);
    expect(rangeOf(entries, markers, "v1", CURRENT)).toEqual(new Set(["c"]));
    expect(rangeOf(entries, markers, CURRENT, entryPoint("before", "a"))).toEqual(
      new Set(["a", "b", "c"]),
    );
  });

  it("is empty when a point is missing", () => {
    expect(rangeOf(entries, markers, "gone", CURRENT)).toEqual(new Set());
    expect(rangeOf(entries, markers, undefined, CURRENT)).toEqual(new Set());
  });
});
