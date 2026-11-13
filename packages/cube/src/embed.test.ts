import { describe, expect, it } from "vitest";
import { embedReview, extractReview } from "./embed.ts";
import type { Review } from "./snapshot.ts";

const review: Review = {
  version: 1,
  snapshotId: "abc",
  reviewer: "Friend",
  updatedAt: "2026-11-08T00:00:00.000Z",
  cards: {
    shock: {
      comment: "</script><b>too good</b>",
      vote: "cut",
      updatedAt: "2026-11-08T00:00:00.000Z",
    },
  },
  moves: [{ slug: "shock", to: "prospect" }],
};

const bundle = [
  'const tpl = "</head></body>";',
  'const marker = `<script id="review-state" type="application/json">`;',
].join("\n");

const html = [
  "<!doctype html><html><head><title>x</title>",
  `<script type="module">${bundle}</script>`,
  "</head>",
  "<body>",
  '  <div id="root"></div>',
  "  </body>",
  "</html>",
].join("\n");

describe("embedReview", () => {
  it("round-trips a review through the document", () => {
    expect(extractReview(embedReview(html, review))).toEqual(review);
  });

  it("leaves the inlined bundle untouched even when it contains </head> or the marker", () => {
    const embedded = embedReview(html, review);
    expect(embedded).toContain(`<script type="module">${bundle}</script>`);
  });

  it("replaces an existing embedded review instead of stacking", () => {
    const once = embedReview(html, review);
    const twice = embedReview(once, { ...review, reviewer: "Other" });
    expect(twice.match(/<script id="review-state" type="application\/json">\{/gu)).toHaveLength(1);
    expect(extractReview(twice)?.reviewer).toBe("Other");
  });

  it("cannot break out of the script tag", () => {
    expect(embedReview(html, review)).not.toContain("</script><b>");
  });

  it("returns undefined when nothing is embedded, despite the marker in the bundle", () => {
    expect(extractReview(html)).toBeUndefined();
  });

  it("reads a review saved before moves travelled as having none", () => {
    const old = embedReview(html, review).replace(
      ',"moves":[{"slug":"shock","to":"prospect"}]',
      "",
    );
    expect(old).not.toContain('"moves"');
    expect(extractReview(old)?.moves).toEqual([]);
  });
});
