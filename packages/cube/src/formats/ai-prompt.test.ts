import { describe, expect, it } from "vitest";
import { AI_IMPORT_EXAMPLE, AI_IMPORT_PROMPT } from "./ai-prompt.ts";
import { boardStatus, parseList } from "./index.ts";

describe("AI import prompt", () => {
  it("shows an example the importer reads as intended", () => {
    const parsed = parseList(AI_IMPORT_EXAMPLE);
    expect(parsed.format).toBe("text");
    expect(
      parsed.rows.map((row) => [
        row.name,
        boardStatus(row.board),
        row.tags,
        row.set,
        row.collectorNumber,
      ]),
    ).toEqual([
      ["Lightning Bolt", "draft", ["Red", "Removal"], "m10", "146"],
      ["Fire // Ice", "draft", ["Red", "Blue"], undefined, undefined],
      ["Counterspell", "prospect", ["Blue"], undefined, undefined],
      ["Llanowar Elves", "cut", [], undefined, undefined],
    ]);
  });

  it("reads an answer pasted with its code fence", () => {
    const parsed = parseList(`\`\`\`text\n${AI_IMPORT_EXAMPLE}\n\`\`\`\n`);
    expect(parsed.rows.map((row) => row.name)).toEqual([
      "Lightning Bolt",
      "Fire // Ice",
      "Counterspell",
      "Llanowar Elves",
    ]);
  });

  it("ends where the user's list goes", () => {
    expect(AI_IMPORT_PROMPT).toContain(AI_IMPORT_EXAMPLE);
    expect(AI_IMPORT_PROMPT.endsWith("My list:\n")).toBe(true);
  });
});
