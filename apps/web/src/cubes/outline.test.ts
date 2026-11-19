import { describe, expect, it } from "vitest";
import { outline } from "./outline.ts";

function cartesian({ turn, radius }: { turn: number; radius: number }): [number, number] {
  const angle = turn * Math.PI * 2;
  return [Math.sin(angle) * radius, -Math.cos(angle) * radius];
}

describe("outline", () => {
  it("keeps the same point count for any spoke count", () => {
    expect(outline([1, 2, 3])).toHaveLength(120);
    expect(outline([1, 2, 3, 4, 5, 6, 7])).toHaveLength(120);
  });

  it("passes through every vertex", () => {
    const radii = [0.3, 0.1, 0.5, 0.2, 0.4, 0.25, 0.15];
    const points = outline(radii);
    radii.forEach((radius, vertex) => {
      const hit = points.find((point) => point.turn === vertex / radii.length);
      expect(hit?.radius).toBeCloseTo(radius);
    });
  });

  it("puts every other point on the straight edge between vertices", () => {
    const radii = [0.4, 0.1, 0.3, 0.2, 0.5];
    const points = outline(radii);
    for (const point of points) {
      const edge = Math.min(radii.length - 1, Math.floor(point.turn * radii.length + 1e-9));
      const [ax, ay] = cartesian({ turn: edge / radii.length, radius: radii[edge] ?? 0 });
      const [bx, by] = cartesian({
        turn: (edge + 1) / radii.length,
        radius: radii[(edge + 1) % radii.length] ?? 0,
      });
      const [px, py] = cartesian(point);
      expect((bx - ax) * (py - ay) - (by - ay) * (px - ax)).toBeCloseTo(0);
    }
  });

  it("draws a zero spoke through the center", () => {
    const points = outline([0, 0.5, 0.5]);
    expect(points[0]?.radius).toBe(0);
    expect(points[1]?.radius).toBe(0);
  });
});
