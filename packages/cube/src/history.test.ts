import { describe, expect, it } from "vitest";
import { CURRENT } from "./diff.ts";
import { entryPoint, parsePoint } from "./history.ts";

describe("parsePoint", () => {
  it("reads the current cube, a version, or a side of a log entry", () => {
    expect(parsePoint(CURRENT)).toEqual({ kind: "current" });
    expect(parsePoint("2026-11-12-v1")).toEqual({ kind: "version", id: "2026-11-12-v1" });
    expect(parsePoint(entryPoint("before", "20261113t1-ab"))).toEqual({
      kind: "entry",
      side: "before",
      entry: "20261113t1-ab",
    });
    expect(parsePoint("during:x")).toEqual({ kind: "version", id: "during:x" });
  });
});
