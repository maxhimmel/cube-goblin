import type { ReactNode } from "react";

export function Gauge({
  count,
  size,
}: {
  count: number;
  size: { min: number; max: number };
}): ReactNode {
  const scale = Math.max(count, size.max) * 1.1;
  const percent = (value: number): string => `${String((value / scale) * 100)}%`;
  const verdict =
    count > size.max
      ? `${String(count - size.max)} over`
      : count < size.min
        ? `${String(size.min - count)} under`
        : "on target";
  const state = count > size.max ? "over" : count < size.min ? "under" : "ok";
  return (
    <div className="gauge" data-verdict={state} data-testid="draft-gauge">
      <div
        className="gauge-track"
        role="meter"
        aria-label="Draft size"
        aria-valuemin={0}
        aria-valuemax={Math.round(scale)}
        aria-valuenow={count}
        aria-valuetext={`${String(count)} cards, target ${String(size.min)} to ${String(size.max)}, ${verdict}`}
      >
        <span
          className="gauge-band"
          style={{ left: percent(size.min), width: percent(size.max - size.min) }}
        />
        <span className="gauge-fill" style={{ width: percent(count) }} />
      </div>
      <span className="gauge-label">
        target {size.min}–{size.max} · <strong>{verdict}</strong>
      </span>
    </div>
  );
}
