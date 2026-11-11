import type { Filter } from "@repo/cube/browser";
import { describe, expect, it } from "vitest";
import { resolvePill, stackQuery } from "./model.ts";

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
