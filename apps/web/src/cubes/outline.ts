export const SAMPLES = 120;

export interface OutlinePoint {
  turn: number;
  radius: number;
}

function chord(theta: number, from: number, to: number, ra: number, rb: number): number {
  const below = ra * Math.sin(theta - from) + rb * Math.sin(to - theta);
  return below <= 1e-12 ? 0 : (ra * rb * Math.sin(to - from)) / below;
}

export function outline(radii: readonly number[], samples = SAMPLES): OutlinePoint[] {
  const count = radii.length;
  const size = Math.max(samples, count * 2);
  const turns = Array.from({ length: size }, (_, index) => index / size);
  radii.forEach((_, vertex) => {
    turns[Math.round((vertex * size) / count) % size] = vertex / count;
  });
  return turns.map((turn) => {
    const edge = Math.min(count - 1, Math.floor(turn * count + 1e-9));
    const from = (edge / count) * Math.PI * 2;
    const to = ((edge + 1) / count) * Math.PI * 2;
    return {
      turn,
      radius: chord(turn * Math.PI * 2, from, to, radii[edge] ?? 0, radii[(edge + 1) % count] ?? 0),
    };
  });
}
