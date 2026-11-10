import { describe, expect, it } from "vitest";
import { VENN_LAYOUTS, inside } from "./geometry.ts";

describe("VENN_LAYOUTS", () => {
  for (const layout of Object.values(VENN_LAYOUTS)) {
    it(`puts every count label of the ${String(layout.circles.length)}-tag Venn in its own region`, () => {
      const keys = Object.keys(layout.counts);
      expect(keys).toHaveLength(2 ** layout.circles.length - 1);
      for (const key of keys) {
        const point = layout.counts[key];
        if (!point) {
          throw new Error(key);
        }
        const members = layout.circles
          .map((circle, index) => (inside(circle, point.x, point.y) ? String(index) : undefined))
          .filter((index) => index !== undefined)
          .join("+");
        expect(members).toBe(key);
      }
    });
  }
});
