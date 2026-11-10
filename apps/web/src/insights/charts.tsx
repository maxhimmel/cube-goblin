import type { Count, GridCell } from "@repo/cube/browser";
import { barX, barY, cell, defineChart, text } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type TickLabel = (id: string) => ReactNode;

export type BarFill = string | ((row: Count) => string);

const BAR = "var(--chart-bar)";
const BAR_THICKNESS = 24;
const TICK_GUTTER = 132;
const MIN_PLOT_HEIGHT = 120;
const HEAT_STEPS = 6;

function peak(rows: readonly Count[]): number {
  return Math.max(1, ...rows.map((row) => row.count));
}

function heatStep(count: number, max: number): number {
  return max === 0 || count === 0 ? 0 : Math.ceil((count / max) * HEAT_STEPS);
}

function heatFill(step: number): string {
  return step === 0 ? "var(--chart-empty)" : `var(--heat-${String(step)})`;
}

function dimmed(color: string, on: boolean): string {
  return on ? color : `color-mix(in oklab, ${color} 30%, transparent)`;
}

function paint(fill: BarFill, row: Count): string {
  return typeof fill === "string" ? fill : fill(row);
}

function usePlotHeight(): [RefObject<HTMLDivElement | null>, number | undefined] {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry?.contentRect.height ?? 0);
      setHeight(next > 0 ? Math.max(MIN_PLOT_HEIGHT, next) : undefined);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  return [ref, height];
}

interface TickScene {
  scene: {
    scales: Partial<Record<"x" | "y", { ticks: readonly { value: unknown; position: number }[] }>>;
    chart: { x: number; y: number; height: number };
  };
}

function useTickOverlay(axis: "x" | "y"): {
  ref: RefObject<HTMLOListElement | null>;
  onRender: (context: TickScene) => void;
} {
  const ref = useRef<HTMLOListElement>(null);
  const onRender = useCallback(
    ({ scene }: TickScene) => {
      const layer = ref.current;
      const scale = scene.scales[axis];
      if (!layer || !scale) {
        return;
      }
      const positions = new Map(scale.ticks.map((tick) => [String(tick.value), tick.position]));
      for (const element of Array.from(layer.children)) {
        if (!(element instanceof HTMLElement)) {
          continue;
        }
        const position = positions.get(element.dataset["tick"] ?? "");
        element.hidden = position === undefined;
        if (axis === "y") {
          element.style.top = `${String(position ?? 0)}px`;
          element.style.left = `${String(scene.chart.x - 10)}px`;
        } else {
          element.style.left = `${String(position ?? 0)}px`;
          element.style.top = `${String(scene.chart.y + scene.chart.height + 8)}px`;
        }
      }
      layer.dataset["ready"] = "true";
    },
    [axis],
  );
  return { ref, onRender };
}

function TickOverlay({
  ids,
  tick,
  axis,
  overlayRef,
  label,
  onPick,
}: {
  ids: readonly string[];
  tick: TickLabel;
  axis: "x" | "y";
  overlayRef: RefObject<HTMLOListElement | null>;
  label: string;
  onPick?: ((id: string) => void) | undefined;
}): ReactNode {
  return (
    <ol ref={overlayRef} className="chart-ticks" data-axis={axis} aria-label={label}>
      {ids.map((id) => (
        <li key={id} data-tick={id}>
          {onPick ? (
            <button
              type="button"
              className="stat-pick"
              tabIndex={-1}
              onClick={() => {
                onPick(id);
              }}
            >
              {tick(id)}
            </button>
          ) : (
            tick(id)
          )}
        </li>
      ))}
    </ol>
  );
}

const INSIDE_LABEL_MIN = 2;

const FOCUS_RING = false;

interface BarProps {
  rows: readonly Count[];
  name: string;
  fill?: BarFill;
  tick?: TickLabel | undefined;
  selected?: string | undefined;
  onPick?: ((id: string) => void) | undefined;
}

function pickFrom(onPick: ((id: string) => void) | undefined) {
  return (point: { datum: { id: string } } | null) => {
    if (point && onPick) {
      onPick(point.datum.id);
    }
  };
}

export function ColumnChart({
  rows,
  name,
  fill = BAR,
  tick,
  selected,
  onPick,
}: BarProps): ReactNode {
  const overlay = useTickOverlay("x");
  const [plot, height] = usePlotHeight();
  const definition = useMemo(
    () =>
      defineChart({
        margin: tick ? { top: 20, bottom: 40 } : { top: 20 },
        marks: [
          barY(rows, {
            x: "id",
            y: "count",
            fill: (row) => dimmed(paint(fill, row), selected === undefined || row.id === selected),
            maxThickness: BAR_THICKNESS,
            radius: [4, 4, 0, 0],
          }),
          text(
            rows.filter((row) => row.count > 0),
            { x: "id", y: "count", text: "count", dy: -8, fill: "currentColor", fontSize: 12 },
          ),
        ],
        scales: {
          x: {
            scale: scaleBand()
              .domain(rows.map((row) => row.id))
              .padding(0.25),
            axis: {
              ticks: {
                size: 0,
                format: (id: string) => rows.find((row) => row.id === id)?.label ?? id,
              },
              ...(tick ? { tickLabels: false } : {}),
            },
          },
          y: { scale: scaleLinear().domain([0, peak(rows)]), axis: false },
        },
        focusRing: FOCUS_RING,
      }),
    [fill, rows, selected, tick],
  );
  return (
    <div className="chart-plot" ref={plot} data-pickable={onPick !== undefined}>
      {tick && (
        <TickOverlay
          ids={rows.map((row) => row.id)}
          tick={tick}
          axis="x"
          overlayRef={overlay.ref}
          label={`${name} axis`}
          onPick={onPick}
        />
      )}
      <Chart
        definition={definition}
        ariaLabel={name}
        height={height ?? 220}
        initialWidth={420}
        onRender={overlay.onRender}
        onSelect={pickFrom(onPick)}
      />
    </div>
  );
}

export function RowChart({ rows, name, fill = BAR, tick, selected, onPick }: BarProps): ReactNode {
  const overlay = useTickOverlay("y");
  const [plot, height] = usePlotHeight();
  const definition = useMemo(
    () =>
      defineChart({
        margin: { right: 36, ...(tick ? { left: TICK_GUTTER } : {}) },
        marks: [
          barX(rows, {
            x: "count",
            y: "id",
            fill: (row) => dimmed(paint(fill, row), selected === undefined || row.id === selected),
            maxThickness: BAR_THICKNESS - 4,
            radius: [0, 4, 4, 0],
          }),
          text(rows, {
            x: "count",
            y: "id",
            text: "count",
            anchor: "start",
            dx: 6,
            fill: "currentColor",
            fontSize: 12,
          }),
        ],
        scales: {
          x: { scale: scaleLinear().domain([0, peak(rows)]), axis: false },
          y: {
            scale: scaleBand()
              .domain(rows.map((row) => row.id))
              .padding(0.2),
            axis: {
              line: false,
              ticks: {
                size: 0,
                format: (id: string) => rows.find((row) => row.id === id)?.label ?? id,
              },
              ...(tick ? { tickLabels: false } : {}),
            },
          },
        },
        focusRing: FOCUS_RING,
      }),
    [fill, rows, selected, tick],
  );
  return (
    <div className="chart-plot" ref={plot} data-pickable={onPick !== undefined}>
      {tick && (
        <TickOverlay
          ids={rows.map((row) => row.id)}
          tick={tick}
          axis="y"
          overlayRef={overlay.ref}
          label={`${name} axis`}
          onPick={onPick}
        />
      )}
      <Chart
        definition={definition}
        ariaLabel={name}
        height={height ?? rows.length * 34 + 12}
        initialWidth={420}
        onRender={overlay.onRender}
        onSelect={pickFrom(onPick)}
      />
    </div>
  );
}

export interface StackedRow {
  id: string;
  label: string;
  bucket: string;
  parts: readonly { bucket: string; label: string; count: number; fill: string; ink: string }[];
}

export function StackedRowChart({
  rows,
  name,
  tick,
  selected,
  onPick,
}: {
  rows: readonly StackedRow[];
  name: string;
  tick?: TickLabel | undefined;
  selected?: string | undefined;
  onPick?: ((bucket: string) => void) | undefined;
}): ReactNode {
  const overlay = useTickOverlay("y");
  const [plot, height] = usePlotHeight();
  const segments = useMemo(
    () =>
      rows.flatMap((row) => {
        let start = 0;
        return row.parts
          .filter((part) => part.count > 0)
          .map((part) => {
            const segment = {
              ...part,
              whole: row.bucket,
              id: part.bucket,
              row: row.id,
              x1: start,
              x2: start + part.count,
            };
            start = segment.x2;
            return segment;
          })
          .map((segment, index, all) => ({ ...segment, last: index === all.length - 1 }));
      }),
    [rows],
  );
  const totals = useMemo(
    () =>
      rows.map((row) => {
        const total = row.parts.reduce((sum, part) => sum + part.count, 0);
        return { row: row.id, total, text: String(total) };
      }),
    [rows],
  );
  const definition = useMemo(
    () =>
      defineChart({
        margin: { right: 36, ...(tick ? { left: TICK_GUTTER } : {}) },
        marks: [
          ...[false, true].map((last) =>
            barX(
              segments.filter((segment) => segment.last === last),
              {
                id: last ? "stack-end" : "stack-inner",
                x1: "x1",
                x2: "x2",
                y: "row",
                fill: (segment) =>
                  dimmed(
                    segment.fill,
                    selected === undefined ||
                      segment.bucket === selected ||
                      segment.whole === selected,
                  ),
                maxThickness: BAR_THICKNESS - 4,
                ...(last ? { radius: [0, 4, 4, 0] as const } : {}),
              },
            ),
          ),
          text(
            segments.filter(
              (segment) =>
                segment.count >= INSIDE_LABEL_MIN &&
                segments.filter((other) => other.row === segment.row).length > 1,
            ),
            {
              x: (segment) => (segment.x1 + segment.x2) / 2,
              y: "row",
              text: "count",
              fill: (segment) =>
                selected === undefined || segment.bucket === selected || segment.whole === selected
                  ? segment.ink
                  : "var(--fg)",
              fontSize: 11,
            },
          ),
          text(totals, {
            x: "total",
            y: "row",
            text: "text",
            anchor: "start",
            dx: 6,
            fill: "currentColor",
            fontSize: 12,
          }),
        ],
        scales: {
          x: {
            scale: scaleLinear().domain([0, Math.max(1, ...totals.map((entry) => entry.total))]),
            axis: false,
          },
          y: {
            scale: scaleBand()
              .domain(rows.map((row) => row.id))
              .padding(0.2),
            axis: {
              line: false,
              ticks: {
                size: 0,
                format: (id: string) => rows.find((row) => row.id === id)?.label ?? id,
              },
              ...(tick ? { tickLabels: false } : {}),
            },
          },
        },
        focusRing: FOCUS_RING,
      }),
    [rows, segments, selected, tick, totals],
  );
  return (
    <div className="chart-plot" ref={plot} data-pickable={onPick !== undefined}>
      {tick && (
        <TickOverlay
          ids={rows.map((row) => row.id)}
          tick={tick}
          axis="y"
          overlayRef={overlay.ref}
          label={`${name} axis`}
          onPick={
            onPick &&
            ((id: string) => {
              const row = rows.find((candidate) => candidate.id === id);
              if (row) {
                onPick(row.bucket);
              }
            })
          }
        />
      )}
      <Chart
        definition={definition}
        ariaLabel={name}
        height={height ?? rows.length * 34 + 12}
        initialWidth={420}
        onRender={overlay.onRender}
        onSelect={(point) => {
          if (point && onPick && "bucket" in point.datum) {
            onPick(point.datum.bucket);
          }
        }}
      />
    </div>
  );
}

export function HeatChart({
  cells,
  rows,
  columns,
  name,
  rowTick,
  columnTick,
  rowTitle,
  columnTitle,
  selected,
  onPick,
}: {
  cells: readonly GridCell[];
  rows: readonly Omit<Count, "count">[];
  columns: readonly Omit<Count, "count">[];
  name: string;
  rowTick: TickLabel;
  columnTick: TickLabel;
  rowTitle?: string | undefined;
  columnTitle?: string | undefined;
  selected?: { row: string; column: string } | undefined;
  onPick?: ((row: string, column: string) => void) | undefined;
}): ReactNode {
  const rowOverlay = useTickOverlay("y");
  const columnOverlay = useTickOverlay("x");
  const [plot, height] = usePlotHeight();
  const placeRows = rowOverlay.onRender;
  const placeColumns = columnOverlay.onRender;
  const onRender = useCallback(
    (context: TickScene) => {
      placeRows(context);
      placeColumns(context);
    },
    [placeRows, placeColumns],
  );
  const max = Math.max(0, ...cells.map((entry) => entry.count));
  const isOn = useCallback(
    (entry: GridCell) =>
      selected === undefined || (entry.row === selected.row && entry.column === selected.column),
    [selected],
  );
  const definition = useMemo(
    () =>
      defineChart({
        margin: { left: TICK_GUTTER, top: 8, bottom: columnTitle === undefined ? 36 : 56 },
        marks: [
          ...Array.from({ length: HEAT_STEPS + 1 }, (_, step) =>
            [true, false].map((on) =>
              cell(
                cells.filter((entry) => heatStep(entry.count, max) === step && isOn(entry) === on),
                {
                  id: `heat-${String(step)}-${String(on)}`,
                  x: "column",
                  y: "row",
                  inset: 1,
                  fill: dimmed(heatFill(step), on),
                },
              ),
            ),
          ).flat(),
          text(
            cells.filter((entry) => entry.count > 0),
            {
              x: "column",
              y: "row",
              text: "count",
              fontSize: 12,
              fill: (entry) =>
                isOn(entry) ? `var(--heat-ink-${String(heatStep(entry.count, max))})` : "var(--fg)",
            },
          ),
        ],
        scales: {
          x: {
            scale: scaleBand()
              .domain(columns.map((column) => column.id))
              .padding(0.04),
            axis: { line: false, ticks: { size: 0 }, tickLabels: false },
          },
          y: {
            scale: scaleBand()
              .domain(rows.map((row) => row.id))
              .padding(0.04),
            axis: { line: false, ticks: { size: 0 }, tickLabels: false },
          },
        },
        focusRing: FOCUS_RING,
      }),
    [cells, columns, columnTitle, isOn, max, rows],
  );
  return (
    <div
      className="chart-plot"
      ref={plot}
      data-pickable={onPick !== undefined}
      style={{ "--tick-gutter": `${String(TICK_GUTTER)}px` } as CSSProperties}
    >
      {rowTitle !== undefined && (
        <span className="axis-title" data-axis="y" aria-hidden="true">
          {rowTitle}
        </span>
      )}
      {columnTitle !== undefined && (
        <span className="axis-title" data-axis="x" aria-hidden="true">
          {columnTitle}
        </span>
      )}
      <TickOverlay
        ids={rows.map((row) => row.id)}
        tick={rowTick}
        axis="y"
        overlayRef={rowOverlay.ref}
        label={`${name} rows`}
      />
      <TickOverlay
        ids={columns.map((column) => column.id)}
        tick={columnTick}
        axis="x"
        overlayRef={columnOverlay.ref}
        label={`${name} columns`}
      />
      <Chart
        definition={definition}
        ariaLabel={name}
        height={height ?? rows.length * 36 + 44}
        initialWidth={420}
        onRender={onRender}
        onSelect={(point) => {
          if (point && onPick) {
            onPick(point.datum.row, point.datum.column);
          }
        }}
      />
    </div>
  );
}

export function CountTable({
  caption,
  rows,
  head,
  selected,
  onPick,
}: {
  caption: string;
  rows: readonly Count[];
  head?: TickLabel | undefined;
  selected?: string | undefined;
  onPick?: ((id: string) => void) | undefined;
}): ReactNode {
  return (
    <table className="stat-table">
      <caption>{caption}</caption>
      <tbody>
        {rows.map((row) => {
          const label = head ? head(row.id) : row.label;
          return (
            <tr key={row.id} data-stat={row.id} aria-current={row.id === selected || undefined}>
              <th scope="row">
                {onPick ? (
                  <button
                    type="button"
                    className="stat-pick"
                    onClick={() => {
                      onPick(row.id);
                    }}
                  >
                    {label}
                  </button>
                ) : (
                  label
                )}
              </th>
              <td>{row.count}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
