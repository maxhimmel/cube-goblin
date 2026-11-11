import type { Tag } from "@repo/cube/browser";
import { describe, expect, it } from "vitest";
import { suggest } from "./query-input.tsx";

const tags: Tag[] = [
  { id: "removal", label: "Removal", kind: "group" },
  { id: "ramp", label: "Ramp", kind: "group" },
];

describe("suggest", () => {
  it("offers keywords and tags for a bare word", () => {
    const texts = suggest("r", tags).map((entry) => entry.text);
    expect(texts).toContain("tag:removal");
    expect(texts).toContain("tag:ramp");
    expect(suggest("po", tags)[0]).toMatchObject({ text: "pow=", complete: false });
  });

  it("completes values for a field, keeping a leading minus", () => {
    expect(suggest("-t:crea", tags)).toEqual([
      expect.objectContaining({ text: "-t:creature", complete: true }),
    ]);
    expect(suggest("tag:re", tags).map((entry) => entry.text)).toEqual(["tag:removal"]);
    expect(suggest("tou>p", tags).map((entry) => entry.text)).toEqual(["tou>pow"]);
  });

  it("offers nothing for unknown fields or finished values", () => {
    expect(suggest("zz:a", tags)).toEqual([]);
    expect(suggest("t:creature", tags)).toEqual([]);
  });
});
