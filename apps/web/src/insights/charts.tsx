import type { Count, GridCell } from "@repo/cube/browser";
import { barX, barY, cell, defineChart, text } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import type { ReactNode, RefObject } from "react";
import { useCallback, useMemo, useRef, useState } from "react";

export type TickLabel = (id: string) => ReactNode;

export type BarFill = string | ((row: Count) => string);

const BAR = "var(--chart-bar)";
const BAR_THICKNESS = 24;
const ROW_HEIGHT = 34;
const TICK_GUTTER = 132;

function labelOf(rows: readonly Count[], datum: { id: string }): string {
  return rows.find((row) => row.id === datum.id)?.label ?? datum.id;
}

function peak(rows: readonly Count[]): number {
  return Math.max(1, ...rows.map((row) => row.count));
}

const HEAT_STEPS = 6;

function heatStep(count: number, max: number): number {
  return max === 0 || count === 0 ? 0 : Math.ceil((count / max) * HEAT_STEPS);
}

function heatFill(step: number): string {
  return step === 0 ? "var(--chart-empty)" : `var(--heat-${String(step)})`;
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
}: {
  ids: readonly string[];
  tick: TickLabel;
  axis: "x" | "y";
  overlayRef: RefObject<HTMLOListElement | null>;
  label: string;
}): ReactNode {
  return (
    <ol ref={overlayRef} className="chart-ticks" data-axis={axis} aria-label={label}>
      {ids.map((id) => (
        <li key={id} data-tick={id}>
          {tick(id)}
        </li>
      ))}
    </ol>
  );
}

export function ColumnChart({
  rows,
  name,
  unit,
  fill = BAR,
  category,
  tick,
}: {
  rows: readonly Count[];
  name: string;
  unit: string;
  fill?: BarFill;
  category: string;
  tick?: TickLabel;
}): ReactNode {
  const overlay = useTickOverlay("x");
  const definition = useMemo(
    () =>
      defineChart({
        margin: tick ? { top: 20, bottom: 40 } : { top: 20 },
        marks: [
          barY(rows, {
            x: "id",
            y: "count",
            fill,
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
        tooltip: {
          use: tooltip,
          format: (point) =>
            `${category} ${labelOf(rows, point.datum)}: ${String(point.datum.count)} ${unit}`,
        },
      }),
    [category, fill, rows, tick, unit],
  );
  return (
    <div className="chart-plot">
      {tick && (
        <TickOverlay
          ids={rows.map((row) => row.id)}
          tick={tick}
          axis="x"
          overlayRef={overlay.ref}
          label={`${name} axis`}
        />
      )}
      <Chart
        definition={definition}
        ariaLabel={name}
        height={220}
        initialWidth={420}
        onRender={overlay.onRender}
      />
    </div>
  );
}

export function RowChart({
  rows,
  name,
  unit,
  fill = BAR,
  tick,
}: {
  rows: readonly Count[];
  name: string;
  unit: string;
  fill?: BarFill;
  tick?: TickLabel;
}): ReactNode {
  const overlay = useTickOverlay("y");
  const definition = useMemo(
    () =>
      defineChart({
        margin: { right: 36, ...(tick ? { left: TICK_GUTTER } : {}) },
        marks: [
          barX(rows, {
            x: "count",
            y: "id",
            fill,
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
        tooltip: {
          use: tooltip,
          format: (point) => `${labelOf(rows, point.datum)}: ${String(point.datum.count)} ${unit}`,
        },
      }),
    [fill, rows, tick, unit],
  );
  return (
    <div className="chart-plot">
      {tick && (
        <TickOverlay
          ids={rows.map((row) => row.id)}
          tick={tick}
          axis="y"
          overlayRef={overlay.ref}
          label={`${name} axis`}
        />
      )}
      <Chart
        definition={definition}
        ariaLabel={name}
        height={rows.length * ROW_HEIGHT + 12}
        initialWidth={420}
        onRender={overlay.onRender}
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
}: {
  cells: readonly GridCell[];
  rows: readonly Omit<Count, "count">[];
  columns: readonly Omit<Count, "count">[];
  name: string;
  rowTick: TickLabel;
  columnTick: TickLabel;
}): ReactNode {
  const rowOverlay = useTickOverlay("y");
  const columnOverlay = useTickOverlay("x");
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
  const definition = useMemo(
    () =>
      defineChart({
        margin: { left: TICK_GUTTER, top: 8, bottom: 36 },
        marks: [
          ...Array.from({ length: HEAT_STEPS + 1 }, (_, step) =>
            cell(
              cells.filter((entry) => heatStep(entry.count, max) === step),
              { id: `heat-${String(step)}`, x: "column", y: "row", inset: 1, fill: heatFill(step) },
            ),
          ),
          text(
            cells.filter((entry) => entry.count > 0),
            {
              x: "column",
              y: "row",
              text: "count",
              fontSize: 12,
              fill: (entry) => `var(--heat-ink-${String(heatStep(entry.count, max))})`,
            },
          ),
        ],
        scales: {
          x: {
            scale: scaleBand()
              .domain(columns.map((column) => column.id))
              .padding(0.04),
            axis: {
              line: false,
              ticks: { size: 0 },
              tickLabels: false,
            },
          },
          y: {
            scale: scaleBand()
              .domain(rows.map((row) => row.id))
              .padding(0.04),
            axis: { line: false, ticks: { size: 0 }, tickLabels: false },
          },
        },
        tooltip: {
          use: tooltip,
          format: (point) => {
            const entry = point.datum;
            const row = rows.find((candidate) => candidate.id === entry.row)?.label ?? "";
            const column = columns.find((candidate) => candidate.id === entry.column)?.label ?? "";
            return `${row}, mana value ${column}: ${String(entry.count)} cards`;
          },
        },
      }),
    [cells, columns, max, rows],
  );
  return (
    <div className="chart-plot">
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
        height={rows.length * 36 + 44}
        initialWidth={420}
        onRender={onRender}
      />
    </div>
  );
}

export function ChartCard({
  title,
  caption,
  table,
  children,
  wide,
}: {
  title: string;
  caption?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}): ReactNode {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="chart-card" data-wide={wide === true}>
      <figcaption>
        <h2>{title}</h2>
        {table !== undefined && (
          <button
            type="button"
            className="chart-toggle"
            aria-pressed={asTable}
            onClick={() => {
              setAsTable(!asTable);
            }}
          >
            Table
          </button>
        )}
      </figcaption>
      {caption !== undefined && <p className="muted chart-caption">{caption}</p>}
      {asTable ? table : children}
    </figure>
  );
}

export function CountTable({
  caption,
  rows,
  head,
}: {
  caption: string;
  rows: readonly Count[];
  head?: TickLabel;
}): ReactNode {
  return (
    <table className="stat-table">
      <caption>{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} data-stat={row.id}>
            <th scope="row">{head ? head(row.id) : row.label}</th>
            <td>{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
