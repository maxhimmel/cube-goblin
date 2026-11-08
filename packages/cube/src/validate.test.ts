import { describe, expect, it } from "vitest";
import type { CardEntry } from "./schema.ts";
import { slugify } from "./store.ts";
import { validateCube } from "./validate.ts";

function card(name: string, oracleId: string, section?: string): CardEntry {
  return {
    name,
    oracleId,
    status: "draft",
    ...(section === undefined ? {} : { section }),
    tags: [],
    notes: "",
    source: { batch: "test", line: 1, input: name },
  };
}

const sections = [{ id: "pirates", label: "Pirates", header: "🏴‍☠️" }];

describe("validateCube", () => {
  it("accepts a clean cube", () => {
    expect(
      validateCube(
        [
          card("Shock", "8b4b6b0e-0000-4000-8000-000000000001"),
          card("Opt", "8b4b6b0e-0000-4000-8000-000000000002", "pirates"),
        ],
        sections,
      ),
    ).toEqual([]);
  });

  it("flags duplicate cards and unknown sections", () => {
    const problems = validateCube(
      [
        card("Shock", "8b4b6b0e-0000-4000-8000-000000000001"),
        card("Shock", "8b4b6b0e-0000-4000-8000-000000000001", "vampires"),
      ],
      sections,
    );
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/Singleton/u);
    expect(problems[1]).toMatch(/unknown section/u);
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
