import { describe, expect, it } from "vitest";
import type { CardEntry } from "./schema.ts";
import { slugify } from "./slug.ts";
import { validateCube } from "./validate.ts";

function card(name: string, oracleId: string): CardEntry {
  return {
    name,
    oracleId,
    status: "draft",
    tags: [],
    notes: "",
    source: { batch: "test", line: 1, input: name },
  };
}

describe("validateCube", () => {
  it("accepts a clean cube", () => {
    expect(
      validateCube(
        [
          card("Shock", "8b4b6b0e-0000-4000-8000-000000000001"),
          card("Opt", "8b4b6b0e-0000-4000-8000-000000000002"),
        ],
        [],
      ),
    ).toEqual([]);
  });

  it("flags duplicate cards", () => {
    const problems = validateCube(
      [
        card("Shock", "8b4b6b0e-0000-4000-8000-000000000001"),
        card("Shock", "8b4b6b0e-0000-4000-8000-000000000001"),
      ],
      [],
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/Singleton/u);
  });

  it("flags tags missing from the vocabulary, repeated tags, and duplicate tag ids", () => {
    const tagged = {
      ...card("Shock", "8b4b6b0e-0000-4000-8000-000000000001"),
      tags: ["burn", "elves", "burn"],
    };
    const vocabulary = [
      { id: "burn", label: "Burn" },
      { id: "burn", label: "Burn again" },
      { id: "shock", label: "burn" },
    ];
    const problems = validateCube([tagged], vocabulary);
    expect(problems).toEqual([
      'Duplicate tag "burn" in tags.json',
      'Duplicate tag label "burn" in tags.json',
      '"Shock" has tag "elves", which is not in tags.json',
      '"Shock" lists a tag more than once',
    ]);
  });
});

describe("slugify", () => {
  it.each([
    ["Dina's Guidance", "dinas-guidance"],
    ["Tom, Bert, and Bill", "tom-bert-and-bill"],
    ["Kinjalli's Sunwing", "kinjallis-sunwing"],
    ["Delver of Secrets // Insectile Aberration", "delver-of-secrets-insectile-aberration"],
  ])("%s -> %s", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
});
