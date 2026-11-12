import parse from "@commitlint/parse";
import { describe, expect, it } from "vitest";
import { subjectCaseAfterTicket } from "./commit-subject.ts";

const NEVER: ("sentence-case" | "start-case" | "pascal-case" | "upper-case")[] = [
  "sentence-case",
  "start-case",
  "pascal-case",
  "upper-case",
];

async function check(subject: string): Promise<boolean> {
  const [valid] = subjectCaseAfterTicket(await parse(`docs(log): ${subject}`), "never", NEVER);
  return valid;
}

describe("subjectCaseAfterTicket", () => {
  it("allows a leading ticket id before a lowercase subject", async () => {
    expect(await check("T-039 built notes and the Log view row")).toBe(true);
    expect(await check("T-039, T-041 log notes")).toBe(true);
  });

  it("still rejects sentence case, with or without a ticket id", async () => {
    expect(await check("Built notes")).toBe(false);
    expect(await check("T-039 Built notes")).toBe(false);
  });

  it("allows ordinary lowercase subjects", async () => {
    expect(await check("stats timeline on the change log")).toBe(true);
  });
});
