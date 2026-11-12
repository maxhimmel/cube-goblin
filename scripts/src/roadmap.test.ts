import { describe, expect, it } from "vitest";
import type { Ticket } from "./roadmap.ts";
import { HANDOFF_MAX_WORDS, isDataOnly, parseTicket, validateRoadmap } from "./roadmap.ts";

const roadmap = (body: { now?: string; next?: string; done?: string; handoff?: string }) =>
  [
    "# Roadmap",
    "## Handoff",
    body.handoff ??
      "- **Updated**: 2026-11-08\n- **State**: clean\n- **Next step**: [T-001](tickets/T-001-a.md)",
    "## Now",
    body.now ?? "- [T-001](tickets/T-001-a.md)",
    "## Next",
    body.next ?? "- [T-002](tickets/T-002-b.md)",
    "## Later",
    "## Done",
    body.done ?? "- None yet.",
  ].join("\n");

const tickets: Ticket[] = [
  { file: "T-001-a.md", id: "T-001", title: "A", status: "doing" },
  { file: "T-002-b.md", id: "T-002", title: "B", status: "todo" },
];

describe("parseTicket", () => {
  it("reads frontmatter fields", () => {
    expect(
      parseTicket("T-001-a.md", "---\nid: T-001\ntitle: Edit: things\nstatus: todo\n---\n# T"),
    ).toEqual({ file: "T-001-a.md", id: "T-001", title: "Edit: things", status: "todo" });
  });
});

describe("validateRoadmap", () => {
  it("accepts a consistent roadmap", () => {
    expect(validateRoadmap(roadmap({}), tickets)).toEqual([]);
  });

  it("flags tickets missing from the roadmap and dangling links", () => {
    const problems = validateRoadmap(roadmap({ next: "- [T-009](tickets/T-009-z.md)" }), tickets);
    expect(problems).toContain("ROADMAP.md links to missing ticket T-009-z.md");
    expect(problems.some((problem) => problem.startsWith("T-002-b.md: listed 0 times"))).toBe(true);
  });

  it("flags status that doesn't match the section", () => {
    const problems = validateRoadmap(
      roadmap({ next: "", done: "- [T-002](tickets/T-002-b.md)" }),
      tickets,
    );
    expect(problems).toContain("T-002-b.md: status 'todo' doesn't match roadmap section 'Done'");
  });

  it("flags doing tickets outside Now", () => {
    const problems = validateRoadmap(
      roadmap({ now: "", next: "- [T-001](tickets/T-001-a.md)\n- [T-002](tickets/T-002-b.md)" }),
      tickets,
    );
    expect(problems).toContain("T-001-a.md: 'doing' tickets belong under Now");
  });

  it("flags an empty handoff field", () => {
    const problems = validateRoadmap(
      roadmap({ handoff: "- **Updated**: 2026-11-08\n- **State**: \n- **Next step**: x" }),
      tickets,
    );
    expect(problems).toEqual(["ROADMAP.md: Handoff is missing a filled '- **State**:' line"]);
  });

  it("flags a handoff over the word limit", () => {
    const long = Array.from({ length: HANDOFF_MAX_WORDS }, () => "word").join(" ");
    const problems = validateRoadmap(
      roadmap({ handoff: `- **Updated**: 2026-11-08\n- **State**: ${long}\n- **Next step**: x` }),
      tickets,
    );
    expect(problems).toEqual([expect.stringMatching(/^ROADMAP\.md: Handoff is \d+ words/u)]);
  });

  it("flags bad ids and statuses", () => {
    const problems = validateRoadmap(roadmap({}), [
      { file: "T-001-a.md", id: "T-002", title: "A", status: "doing" },
      { file: "T-002-b.md", id: "T-002", title: "B", status: "wip" },
    ]);
    expect(problems).toContain("T-001-a.md: frontmatter id 'T-002' should be 'T-001'");
    expect(problems).toContain(
      "T-002-b.md: status 'wip' must be one of todo, doing, blocked, done",
    );
  });
});

describe("isDataOnly", () => {
  it("is true only when every changed file is cube data", () => {
    expect(isDataOnly(["cube/log.jsonl", "cube/cards/shock.json"])).toBe(true);
    expect(isDataOnly(["cube/log.jsonl", "docs/ROADMAP.md"])).toBe(false);
    expect(isDataOnly([])).toBe(false);
  });
});
