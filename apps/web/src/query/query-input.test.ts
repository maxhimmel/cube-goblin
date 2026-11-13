import type { Tag } from "@repo/cube/browser";
import { describe, expect, it } from "vitest";
import { joinTyped, suggest, typedQuery } from "./query-input.tsx";

const tags: Tag[] = [
  { id: "removal", label: "Removal" },
  { id: "ramp", label: "Ramp" },
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

describe("typed connectors", () => {
  it("offers no keyword for and or or", () => {
    expect(suggest("or", tags)).toEqual([]);
    expect(suggest("AND", tags)).toEqual([]);
  });

  it("joins the term after or with the last pill", () => {
    expect(joinTyped("t:creature c=r", "or c=g ")).toBe("t:creature (c=r or c=g)");
    expect(joinTyped("t:creature (c=r or c=g)", "or c=w")).toBe("t:creature ((c=r or c=g) or c=w)");
    expect(joinTyped("", "or c=g")).toBe("c=g");
  });

  it("drops an and, which pills already mean", () => {
    expect(joinTyped("c=r", "and t:creature ")).toBe("c=r t:creature");
    expect(joinTyped("c=r", "and ")).toBeUndefined();
  });

  it("holds a lone connector without breaking the query", () => {
    expect(typedQuery("c=r", "or ")).toBe("c=r");
    expect(typedQuery("c=r", "and")).toBe("c=r");
    expect(typedQuery("t:creature c=r", "or c=g")).toBe("t:creature (c=r or c=g)");
  });
});
