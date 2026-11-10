export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

export interface NameLabel {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
}

export interface VennLayout {
  width: number;
  height: number;
  circles: Circle[];
  names: NameLabel[];
  counts: Record<string, { x: number; y: number }>;
}

export const VENN_LAYOUTS: Record<2 | 3, VennLayout> = {
  2: {
    width: 360,
    height: 220,
    circles: [
      { cx: 140, cy: 120, r: 80 },
      { cx: 220, cy: 120, r: 80 },
    ],
    names: [
      { x: 124, y: 28, anchor: "end" },
      { x: 236, y: 28, anchor: "start" },
    ],
    counts: { "0": { x: 100, y: 120 }, "1": { x: 260, y: 120 }, "0+1": { x: 180, y: 120 } },
  },
  3: {
    width: 360,
    height: 290,
    circles: [
      { cx: 145, cy: 115, r: 78 },
      { cx: 215, cy: 115, r: 78 },
      { cx: 180, cy: 175, r: 78 },
    ],
    names: [
      { x: 130, y: 27, anchor: "end" },
      { x: 230, y: 27, anchor: "start" },
      { x: 180, y: 278, anchor: "middle" },
    ],
    counts: {
      "0": { x: 110, y: 95 },
      "1": { x: 250, y: 95 },
      "2": { x: 180, y: 215 },
      "0+1": { x: 180, y: 90 },
      "0+2": { x: 145, y: 162 },
      "1+2": { x: 215, y: 162 },
      "0+1+2": { x: 180, y: 130 },
    },
  },
};

export function inside(circle: Circle, x: number, y: number): boolean {
  return (x - circle.cx) ** 2 + (y - circle.cy) ** 2 <= circle.r ** 2;
}
