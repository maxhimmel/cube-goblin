import type { CompareUnit, GroupRow, Standout } from "@repo/cube/browser";
import type { CSSProperties, ReactNode } from "react";
import { PinIcon } from "../icons.tsx";
import type { Column } from "./model.ts";
import { OUTLIER, PERCENT, gapLabel, hueOf, percent, spread } from "./model.ts";
import type { StatRow } from "./rows.tsx";

const BAR_SPAN = 0.15;
const HALF = 50;

export type PanelTab = "pinned" | "gaps";

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

function bestCell(row: GroupRow | undefined): { cube: number; delta: number } | undefined {
  return row?.cells.reduce<{ cube: number; delta: number }>(
    (found, cell, cube) =>
      Math.abs(cell.delta) > Math.abs(found.delta) ? { cube, delta: cell.delta } : found,
    { cube: 0, delta: 0 },
  );
}

function SpokeName({ spec, id }: { spec: StatRow | undefined; id: string }): ReactNode {
  return (
    <>
      {spec?.icon}
      <span className={spec?.iconOnly ? "sr-only" : undefined}>{spec?.label ?? id}</span>
      <small>{spec?.section}</small>
    </>
  );
}

export interface InspectorProps {
  axis: string | undefined;
  rowOf: ReadonlyMap<string, GroupRow>;
  specs: ReadonlyMap<string, StatRow>;
  columns: readonly Column[];
  unit: CompareUnit;
  pins: readonly string[];
  gaps: readonly Standout[];
  hover: string | undefined;
  caption: string;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  onHover: (axis: string | undefined) => void;
  onGo: (axis: string) => void;
  onPin: (axis: string) => void;
}

export function Inspector({
  axis,
  rowOf,
  specs,
  columns,
  unit,
  pins,
  gaps,
  hover,
  caption,
  tab,
  onTab,
  onHover,
  onGo,
  onPin,
}: InspectorProps): ReactNode {
  const row = axis === undefined ? undefined : rowOf.get(axis);
  const pinSet = new Set(pins);
  const hoverProps = (id: string) => ({
    onPointerEnter: () => {
      onHover(id);
    },
    onPointerLeave: () => {
      onHover(undefined);
    },
    onFocus: () => {
      onHover(id);
    },
    onBlur: () => {
      onHover(undefined);
    },
  });
  return (
    <aside className="cubes-inspector" aria-label="Inspector">
      <section className="cubes-detail" aria-label="Spoke detail">
        <p className="cubes-caption" data-hovering={hover === undefined ? undefined : ""}>
          {caption}
        </p>
        {row ? (
          <SpokeCard row={row} spec={specs.get(row.id)} columns={columns} unit={unit} />
        ) : (
          <p className="cubes-empty">Hover a spoke to see every cube's number on it.</p>
        )}
      </section>
      <div className="segmented cubes-tabs" role="tablist" aria-label="Lists">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "gaps"}
          onClick={() => {
            onTab("gaps");
          }}
        >
          Biggest gaps
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pinned"}
          onClick={() => {
            onTab("pinned");
          }}
        >
          Pinned <span className="cubes-count">{pins.length}</span>
        </button>
      </div>
      {tab === "pinned" ? (
        pins.length === 0 ? (
          <p className="cubes-empty">
            Click a spoke on the big radar to pin it. Pins build your Custom radar.
          </p>
        ) : (
          <ul className="cubes-list" aria-label="Pinned spokes">
            {pins.map((id) => {
              const spec = specs.get(id);
              const best = bestCell(rowOf.get(id));
              return (
                <li key={id} data-hover={hover === id ? "" : undefined}>
                  <button
                    type="button"
                    className="cubes-item"
                    {...hoverProps(id)}
                    onClick={() => {
                      onGo(id);
                    }}
                  >
                    <SpokeName spec={spec} id={id} />
                  </button>
                  {best && Math.abs(best.delta) >= OUTLIER ? (
                    <span
                      className="cubes-item-gap"
                      style={{ "--hue": hueOf(best.cube) } as CSSProperties}
                      title={`${columns[best.cube]?.cube.name ?? ""} ${gapLabel(best.delta)} points`}
                    >
                      {gapLabel(best.delta)}
                    </span>
                  ) : (
                    <span className="cubes-item-gap">even</span>
                  )}
                  <button
                    type="button"
                    className="cubes-pin"
                    aria-pressed="true"
                    aria-label={`Unpin ${spec?.label ?? id}`}
                    title="Unpin from Custom"
                    onClick={() => {
                      onPin(id);
                    }}
                  >
                    <PinIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <ol className="cubes-list cubes-gaps" aria-label="Biggest gaps">
          {gaps.map((gap) => {
            const spec = specs.get(gap.id);
            const name = columns[gap.cube]?.cube.name ?? "";
            return (
              <li key={gap.id} data-hover={hover === gap.id ? "" : undefined}>
                <button
                  type="button"
                  className="cubes-item"
                  {...hoverProps(gap.id)}
                  onClick={() => {
                    onGo(gap.id);
                  }}
                >
                  <span className="cubes-gap-line">
                    {spec?.icon}
                    <strong className={spec?.iconOnly ? "sr-only" : undefined}>
                      {spec?.label ?? gap.id}
                    </strong>
                    <small>{spec?.section}</small>
                  </span>
                  <span className="cubes-gap-line">
                    <span
                      className="cubes-who"
                      style={{ "--hue": hueOf(gap.cube) } as CSSProperties}
                    >
                      {name}
                    </span>
                    <span className="cubes-muted">
                      {percent(gap.share)} vs {percent(gap.mean)}
                    </span>
                  </span>
                </button>
                <Gap delta={gap.delta} />
                <button
                  type="button"
                  className="cubes-pin"
                  aria-pressed={pinSet.has(gap.id)}
                  aria-label={`${pinSet.has(gap.id) ? "Unpin" : "Pin"} ${spec?.label ?? gap.id}`}
                  title={pinSet.has(gap.id) ? "Unpin from Custom" : "Pin to Custom"}
                  onClick={() => {
                    onPin(gap.id);
                  }}
                >
                  <PinIcon />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <p className="cubes-hint">
        Hover a row to find it on the charts; click it to open its section. Gaps are points from the
        average, out of {PERCENT}.
      </p>
    </aside>
  );
}
