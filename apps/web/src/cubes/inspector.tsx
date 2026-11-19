import type { CompareUnit, GroupRow } from "@repo/cube/browser";
import type { CSSProperties, ReactNode } from "react";
import type { Column } from "./model.ts";
import { OUTLIER, PERCENT, gapLabel, hueOf, percent } from "./model.ts";
import type { StatRow } from "./rows.tsx";

const BAR_SPAN = 0.15;
const HALF = 50;

function value(row: GroupRow, cube: number, unit: CompareUnit): string {
  const cell = row.cells[cube];
  return cell ? (unit === "share" ? percent(cell.share) : String(cell.count)) : "";
}

function Gap({ delta }: { delta: number }): ReactNode {
  return Math.abs(delta) >= OUTLIER ? (
    <span className="cubes-gap" data-dir={delta > 0 ? "more" : "less"}>
      {gapLabel(delta)}
    </span>
  ) : null;
}

function SpokeCard({
  row,
  spec,
  columns,
  unit,
}: {
  row: GroupRow;
  spec: StatRow | undefined;
  columns: readonly Column[];
  unit: CompareUnit;
}): ReactNode {
  const span = Math.max(BAR_SPAN, spread(row));
  const meanCount = row.cells.reduce((sum, cell) => sum + cell.count, 0) / row.cells.length;
  return (
    <div className="cubes-spoke" aria-label={`Inspecting ${spec?.label ?? row.id}`}>
      <div className="cubes-spoke-title">
        {spec?.icon}
        <strong>{spec?.label ?? row.id}</strong>
        <small>{spec?.section}</small>
      </div>
      <div className="cubes-spoke-rows" role="table">
        {columns.map((column, cube) => {
          const delta = row.cells[cube]?.delta ?? 0;
          const width = (Math.abs(delta) / span) * HALF;
          return (
            <div
              key={column.cube.dir}
              role="row"
              data-cube={cube}
              style={{ "--hue": hueOf(cube) } as CSSProperties}
            >
              <span role="rowheader" className="cubes-who">
                {column.cube.name}
              </span>
              <span className="cubes-dev" aria-hidden="true">
                <b
                  style={{
                    left: `${String(delta < 0 ? HALF - width : HALF)}%`,
                    width: `${String(width)}%`,
                  }}
                />
                <i style={{ left: `${String(HALF + (delta < 0 ? -width : width))}%` }} />
              </span>
              <span role="cell" className="cubes-num">
                {value(row, cube, unit)}
              </span>
              <span role="cell">
                <Gap delta={delta} />
              </span>
            </div>
          );
        })}
        <div role="row" className="cubes-avg-row">
          <span role="rowheader">Average</span>
          <span />
          <span role="cell" className="cubes-num">
            {unit === "share" ? percent(row.mean) : meanCount.toFixed(1)}
          </span>
          <span />
        </div>
      </div>
    </div>
  );
}

function spread(row: GroupRow): number {
  return Math.max(0, ...row.cells.map((cell) => Math.abs(cell.delta)));
}

export function Inspector({
  axis,
  rowOf,
  specs,
  columns,
  unit,
  pins,
  hover,
  onInspect,
  onUnpin,
}: {
  axis: string | undefined;
  rowOf: ReadonlyMap<string, GroupRow>;
  specs: ReadonlyMap<string, StatRow>;
  columns: readonly Column[];
  unit: CompareUnit;
  pins: readonly string[];
  hover: string | undefined;
  onInspect: (axis: string | undefined) => void;
  onUnpin: (axis: string) => void;
}): ReactNode {
  const row = axis === undefined ? undefined : rowOf.get(axis);
  return (
    <aside className="cubes-inspector" aria-label="Inspector">
      <h2>Inspecting</h2>
      {row ? (
        <SpokeCard row={row} spec={specs.get(row.id)} columns={columns} unit={unit} />
      ) : (
        <p className="cubes-empty">Hover a spoke to see every cube's number on it.</p>
      )}
      <h2>
        Pinned <span className="cubes-count">{pins.length}</span>
      </h2>
      {pins.length === 0 ? (
        <p className="cubes-empty">
          Click a spoke on the big radar to pin it. Pins build your Custom radar.
        </p>
      ) : (
        <ul className="cubes-pins" aria-label="Pinned spokes">
          {pins.map((id) => {
            const pinned = rowOf.get(id);
            const spec = specs.get(id);
            const best = pinned?.cells.reduce<{ cube: number; delta: number }>(
              (found, cell, cube) =>
                Math.abs(cell.delta) > Math.abs(found.delta) ? { cube, delta: cell.delta } : found,
              { cube: 0, delta: 0 },
            );
            return (
              <li key={id} data-hover={hover === id ? "" : undefined}>
                <button
                  type="button"
                  className="cubes-pin"
                  onPointerEnter={() => {
                    onInspect(id);
                  }}
                  onFocus={() => {
                    onInspect(id);
                  }}
                >
                  {spec?.icon}
                  <span>{spec?.label ?? id}</span>
                  <small>{spec?.section}</small>
                </button>
                {best && Math.abs(best.delta) >= OUTLIER ? (
                  <span
                    className="cubes-pin-gap"
                    style={{ "--hue": hueOf(best.cube) } as CSSProperties}
                    title={`${columns[best.cube]?.cube.name ?? ""} ${gapLabel(best.delta)} points`}
                  >
                    {gapLabel(best.delta)}
                  </span>
                ) : (
                  <span className="cubes-pin-gap">even</span>
                )}
                <button
                  type="button"
                  className="cubes-unpin"
                  aria-label={`Unpin ${spec?.label ?? id}`}
                  onClick={() => {
                    onUnpin(id);
                  }}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="cubes-hint">
        Pins stay while you switch sections. Gaps are points from the average, out of {PERCENT}.
      </p>
    </aside>
  );
}
