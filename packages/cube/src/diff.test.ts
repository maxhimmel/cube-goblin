import { describe, expect, it } from "vitest";
import type { CubeState } from "./diff.ts";
import { diffCube } from "./diff.ts";
import type { CardEntry } from "./schema.ts";

function card(name: string, oracleId: string, overrides: Partial<CardEntry> = {}): CardEntry {
  return {
    name,
    oracleId,
    status: "draft",
    tags: [],
    notes: "",
    source: { batch: "workbench", line: 1, input: name },
    ...overrides,
  };
}

const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const before: CubeState = {
  cards: [
    card("Shock", ID(1), { tags: ["burn"] }),
    card("Ponder", ID(2), { status: "prospect" }),
    card("Doom Blade", ID(3), { notes: "fine" }),
    card("Forest", ID(4)),
  ],
  tags: [
    { id: "burn", label: "Burn", kind: "group" },
    { id: "tempo", label: "Tempo", kind: "archetype" },
  ],
  board: {
    sections: [
      { id: "removal", label: "Removal", cards: ["shock", "doom-blade"], tags: [] },
      { id: "old", label: "Old", cards: ["forest"], tags: [] },
    ],
  },
};

const after: CubeState = {
  cards: [
    card("Shock", ID(1), { tags: ["removal"] }),
    card("Ponder", ID(2)),
    card("Doom Blade", ID(3), { status: "cut", notes: "too slow" }),
    card("Forest", ID(4)),
    card("Bolt", ID(5), { status: "prospect" }),
  ],
  tags: [
    { id: "burn", label: "Burn spells", kind: "group" },
    { id: "removal", label: "Removal", kind: "group" },
  ],
  board: {
    sections: [
      { id: "removal", label: "Kill", cards: ["shock", "bolt"], tags: ["removal"] },
      { id: "ramp", label: "Ramp", cards: [], tags: [] },
    ],
  },
};

describe("diffCube", () => {
  const diff = diffCube(before, after);

  it("lists only changed cards, by name, with status moves and edits", () => {
    expect(diff.cards).toEqual([
      {
        slug: "bolt",
        name: "Bolt",
        after: "prospect",
        tagsAdded: [],
        tagsRemoved: [],
        notesChanged: false,
        printingChanged: false,
      },
      {
        slug: "doom-blade",
        name: "Doom Blade",
        before: "draft",
        after: "cut",
        tagsAdded: [],
        tagsRemoved: [],
        notesChanged: true,
        printingChanged: false,
      },
      {
        slug: "ponder",
        name: "Ponder",
        before: "prospect",
        after: "draft",
        tagsAdded: [],
        tagsRemoved: [],
        notesChanged: false,
        printingChanged: false,
      },
      {
        slug: "shock",
        name: "Shock",
        before: "draft",
        after: "draft",
        tagsAdded: ["removal"],
        tagsRemoved: ["burn"],
        notesChanged: false,
        printingChanged: false,
      },
    ]);
  });

  it("reports a card missing from the later state as removed", () => {
    const back = diffCube(after, before);
    expect(back.cards.find((card) => card.name === "Bolt")).toMatchObject({ before: "prospect" });
    expect(back.cards.find((card) => card.name === "Bolt")?.after).toBeUndefined();
  });

  it("diffs the tag list", () => {
    expect(diff.tags).toEqual({
      added: [{ id: "removal", label: "Removal", kind: "group" }],
      removed: [{ id: "tempo", label: "Tempo", kind: "archetype" }],
      changed: [
        {
          before: { id: "burn", label: "Burn", kind: "group" },
          after: { id: "burn", label: "Burn spells", kind: "group" },
        },
      ],
    });
  });

  it("diffs Board sections", () => {
    expect(diff.sections).toEqual([
      {
        id: "removal",
        label: "Kill",
        change: "changed",
        renamedFrom: "Removal",
        cardsAdded: ["bolt"],
        cardsRemoved: ["doom-blade"],
        tagsAdded: ["removal"],
        tagsRemoved: [],
      },
      {
        id: "ramp",
        label: "Ramp",
        change: "added",
        cardsAdded: [],
        cardsRemoved: [],
        tagsAdded: [],
        tagsRemoved: [],
      },
      {
        id: "old",
        label: "Old",
        change: "removed",
        cardsAdded: [],
        cardsRemoved: ["forest"],
        tagsAdded: [],
        tagsRemoved: [],
      },
    ]);
  });

  it("counts statuses on both sides", () => {
    expect(diff.counts).toEqual({
      before: { draft: 3, prospect: 1, cut: 0 },
      after: { draft: 3, prospect: 1, cut: 1 },
    });
  });

  it("names every card and tag from both states", () => {
    expect(diff.names["doom-blade"]).toBe("Doom Blade");
    expect(diff.names["bolt"]).toBe("Bolt");
    expect(diff.vocabulary.map((tag) => tag.id)).toEqual(["burn", "removal", "tempo"]);
  });

  it("reports a renamed card", () => {
    const renamed = diffCube(before, {
      ...before,
      cards: before.cards.map((entry) =>
        entry.name === "Shock" ? { ...entry, name: "Shock (new)" } : entry,
      ),
    });
    expect(renamed.cards).toMatchObject([{ name: "Shock (new)", renamedFrom: "Shock" }]);
  });

  it("finds nothing between a state and itself", () => {
    const same = diffCube(before, before);
    expect(same.cards).toEqual([]);
    expect(same.sections).toEqual([]);
    expect(same.tags).toEqual({ added: [], removed: [], changed: [] });
  });
});
