import type { Filter } from "@repo/cube/browser";
import { describe, expect, it } from "vitest";
import { peekKeys, pickKeys, resolvePill, stackQuery } from "./model.ts";

const filters: Filter[] = [
  { id: "cheap", label: "Cheap", query: "mv<=2 or t:land", view: "cards" },
];

describe("stackQuery", () => {
  it("joins typed queries, saved filters, and chart buckets into one query", () => {
    expect(stackQuery(["x:c=r", "f:cheap", "curve:2", "pt:2:3"], filters)).toBe(
      "c=r (mv<=2 or t:land) mv=2 t:creature pow=2 tou=3",
    );
  });

  it("skips pills it can't resolve", () => {
    expect(stackQuery(["f:gone", "tag:removal"], filters)).toBe("tag:removal");
  });
});

describe("resolvePill", () => {
  it("labels a power by toughness cell", () => {
    expect(resolvePill("pt:2:3", filters)?.label).toBe("2/3");
  });
});

describe("picking chart buckets", () => {
  it("ors buckets from the same chart and ands different charts", () => {
    const one = pickKeys([], "colorCurve:R:2");
    expect(one).toEqual(["colorCurve:R:2"]);
    const two = pickKeys(one, "colorCurve:U:3");
    expect(two).toEqual(["or:colorCurve:R:2|colorCurve:U:3"]);
    expect(pickKeys(two, "curve:1")).toEqual(["or:colorCurve:R:2|colorCurve:U:3", "curve:1"]);
    expect(pickKeys(two, "colorCurve:R:2")).toEqual(["colorCurve:U:3"]);
    expect(pickKeys(["colorCurve:U:3"], "colorCurve:U:3")).toEqual([]);
    expect(pickKeys(["x:c=r"], "x:c=r")).toEqual([]);
  });

  it("previews a pick on hover without undoing one already made", () => {
    expect(peekKeys(["curve:2"], "curve:3")).toEqual(["or:curve:2|curve:3"]);
    expect(peekKeys(["or:curve:2|curve:3"], "curve:3")).toEqual(["or:curve:2|curve:3"]);
    expect(peekKeys(["curve:2"], "f:cheap")).toEqual(["curve:2", "f:cheap"]);
  });

  it("labels, tests, and queries an or pill", () => {
    const pill = resolvePill("or:curve:2|tag:removal", filters);
    expect(pill?.label).toBe("MV 2 or #removal");
    expect(stackQuery(["or:curve:2|curve:3", "x:c=r"], filters)).toBe("((mv=2) or (mv=3)) c=r");
  });
});
