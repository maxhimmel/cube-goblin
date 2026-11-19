import type { CompareUnit, GroupRow } from "@repo/cube/browser";
import { defineChart } from "@tanstack/charts";
import {
  angleGrid,
  focusGroupAngle,
  polar,
  radialArea,
  radialDot,
  radialGrid,
  radialLine,
} from "@tanstack/charts/polar";
import { Chart } from "@tanstack/charts/react/core";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { curveLinearClosed } from "d3-shape";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { CHART_MOTION, usePlotHeight } from "../insights/charts.tsx";
import { OUTLIER, PERCENT } from "./model.ts";
import type { StatRow } from "./rows.tsx";

const HERO_RATIO = 0.66;
const TILE_RATIO = 0.86;
const SHARE_STEPS = [0.05, 0.1, 0.2, 0.25];
const COUNT_STEPS = [1, 2, 5, 10, 20, 25, 50, 100];
const MAX_RINGS = 5;
const LABEL_GAP = 16;
const SIDE_LIMIT = 0.2;

export interface RadarCube {
  name: string;
  hue: string;
}

interface Point {
  id: string;
  cube: number;
  axis: string;
  value: number;
  delta: number;
}

interface Mean {
  id: string;
  axis: string;
  value: number;
}

function ringsFor(peak: number, unit: CompareUnit): number[] {
  const steps = unit === "share" ? SHARE_STEPS : COUNT_STEPS;
  const step = steps.find((candidate) => peak / candidate <= MAX_RINGS) ?? steps.at(-1) ?? 1;
  const count = Math.max(1, Math.ceil(peak / step - 1e-9));
  return Array.from({ length: count }, (_, index) => step * (index + 1));
}

function amount(value: number, unit: CompareUnit): string {
  return unit === "share" ? `${String(Math.round(value * PERCENT))}%` : String(Math.round(value));
}

interface RadarInput {
  rows: readonly GroupRow[];
  cubes: readonly RadarCube[];
  unit: CompareUnit;
  tile: boolean;
}

function meanOf(row: GroupRow, unit: CompareUnit): number {
  return unit === "share"
    ? row.mean
    : row.cells.reduce((sum, cell) => sum + cell.count, 0) / Math.max(1, row.cells.length);
}

function radarDefinition({ rows, cubes, unit, tile }: RadarInput) {
  const axes = rows.map((row) => row.id);
  const series: Point[][] = cubes.map((_, cube) =>
    rows.map((row) => {
      const cell = row.cells[cube] ?? { count: 0, share: 0, delta: 0 };
      return {
        id: `${String(cube)}:${row.id}`,
        cube,
        axis: row.id,
        value: unit === "share" ? cell.share : cell.count,
        delta: cell.delta,
      };
    }),
  );
  const means: Mean[] = rows.map((row) => ({
    id: `mean:${row.id}`,
    axis: row.id,
    value: meanOf(row, unit),
  }));
  const rings = ringsFor(
    Math.max(...series.flat().map((point) => point.value), ...means.map((mean) => mean.value)),
    unit,
  );
  const top = rings.at(-1) ?? 1;
  return defineChart({
    marks: [
      polar({
        radiusRatio: tile ? TILE_RATIO : HERO_RATIO,
        scales: {
          angle: { scale: scalePoint().domain(axes), wrap: true },
          radius: { scale: scaleLinear().domain([0, top]) },
        },
        guides: [
          radialGrid({
            values: rings,
            shape: "polygon",
            stroke: "var(--radar-grid)",
            labels: !tile,
            labelAngle: Math.PI / Math.max(1, axes.length),
            format: (value) => amount(Number(value), unit),
          }),
          angleGrid({ labels: false, stroke: "var(--radar-grid)" }),
        ],
        marks: [
          ...series.map((cubePoints, cube) =>
            radialArea(cubePoints, {
              id: `area-${String(cube)}`,
              className: `radar-cube radar-cube-${String(cube)}`,
              angle: "axis",
              radius: "value",
              key: "id",
              curve: curveLinearClosed,
              fill: cubes[cube]?.hue ?? "currentColor",
              fillOpacity: 0.16,
              stroke: cubes[cube]?.hue ?? "currentColor",
              strokeWidth: tile ? 1.5 : 2,
            }),
          ),
          radialLine(means, {
            id: "mean",
            className: "radar-mean",
            angle: "axis",
            radius: "value",
            key: "id",
            curve: curveLinearClosed,
            stroke: "var(--fg)",
            strokeWidth: 1.4,
            strokeDasharray: "4 4",
          }),
          ...series.map((cubePoints, cube) =>
            radialDot(
              cubePoints.filter((point) => Math.abs(point.delta) >= OUTLIER),
              {
                id: `outliers-${String(cube)}`,
                className: `radar-cube radar-cube-${String(cube)}`,
                angle: "axis",
                radius: "value",
                key: "id",
                r: tile ? 3 : 5,
                fill: cubes[cube]?.hue ?? "currentColor",
                stroke: "var(--panel)",
                strokeWidth: 2,
              },
            ),
          ),
        ],
      }),
    ],
    scales: { x: null, y: null },
    focus: focusGroupAngle,
  });
}

function useStableDefinition(input: RadarInput) {
  const key = JSON.stringify([input.rows, input.cubes, input.unit, input.tile]);
  const [held, setHeld] = useState({ key, input });
  if (held.key !== key) {
    setHeld({ key, input });
  }
  return useMemo(() => radarDefinition(held.input), [held]);
}

interface Scene {
  scene: { chart: { x: number; y: number; width?: number; height: number } };
}

export function RadarTile({
  title,
  rows,
  cubes,
  unit,
}: {
  title: string;
  rows: readonly GroupRow[];
  cubes: readonly RadarCube[];
  unit: CompareUnit;
}): ReactNode {
  const definition = useStableDefinition({ rows, cubes, unit, tile: true });
  const [plot, height] = usePlotHeight();
  return (
    <div className="cubes-tile-plot" ref={plot}>
      {height !== undefined && (
        <Chart
          renderer={CHART_MOTION}
          definition={definition}
          ariaLabel={`${title} radar`}
          height={height}
          initialWidth={height}
        />
      )}
    </div>
  );
}

export function RadarHero({
  title,
  rows,
  specs,
  cubes,
  unit,
  mixed,
  pins,
  hover,
  onAxis,
  onPin,
  onHotCube,
}: {
  title: string;
  rows: readonly GroupRow[];
  specs: ReadonlyMap<string, StatRow>;
  cubes: readonly RadarCube[];
  unit: CompareUnit;
  mixed: boolean;
  pins: ReadonlySet<string>;
  hover: string | undefined;
  onAxis: (axis: string | undefined) => void;
  onPin: (axis: string) => void;
  onHotCube: (cube: number | undefined) => void;
}): ReactNode {
  const labels = useRef<HTMLOListElement>(null);
  const definition = useStableDefinition({ rows, cubes, unit, tile: false });
  const [plot, height] = usePlotHeight();
  const count = rows.length;
  const place = useCallback(
    ({ scene }: Scene) => {
      const layer = labels.current;
      if (!layer) {
        return;
      }
      const width = scene.chart.width ?? 0;
      const cx = scene.chart.x + width / 2;
      const cy = scene.chart.y + scene.chart.height / 2;
      const reach = (Math.min(width, scene.chart.height) / 2) * HERO_RATIO + LABEL_GAP;
      Array.from(layer.children).forEach((element, index) => {
        if (!(element instanceof HTMLElement)) {
          return;
        }
        const angle = (index / Math.max(1, count)) * Math.PI * 2;
        element.style.left = `${String(cx + Math.sin(angle) * reach)}px`;
        element.style.top = `${String(cy - Math.cos(angle) * reach)}px`;
        element.dataset["side"] =
          Math.abs(Math.sin(angle)) < SIDE_LIMIT
            ? "middle"
            : Math.sin(angle) > 0
              ? "right"
              : "left";
      });
      layer.dataset["ready"] = "true";
    },
    [count],
  );
  return (
    <div
      className="cubes-hero-plot"
      ref={plot}
      onPointerLeave={() => {
        onHotCube(undefined);
        onAxis(undefined);
      }}
    >
      <ol ref={labels} className="cubes-radar-labels" aria-label={`${title} spokes`}>
        {rows.map((row) => {
          const spec = specs.get(row.id);
          const label = spec?.label ?? row.id;
          const pinned = pins.has(row.id);
          return (
            <li key={row.id}>
              <button
                type="button"
                aria-pressed={pinned}
                aria-label={`${pinned ? "Unpin" : "Pin"} ${label}${mixed && spec ? ` (${spec.section})` : ""}`}
                data-hover={hover === row.id ? "" : undefined}
                onPointerEnter={() => {
                  onAxis(row.id);
                }}
                onFocus={() => {
                  onAxis(row.id);
                }}
                onClick={() => {
                  onPin(row.id);
                }}
              >
                {spec?.icon}
                <span>{label}</span>
                {mixed && spec && <small>{spec.section}</small>}
              </button>
            </li>
          );
        })}
      </ol>
      {height !== undefined && (
        <Chart
          renderer={CHART_MOTION}
          definition={definition}
          ariaLabel={`${title}: ${cubes.map((cube) => cube.name).join(", ")} against their average`}
          height={height}
          initialWidth={height}
          onRender={place}
          onFocusChange={(point) => {
            const datum = point?.datum;
            onHotCube(datum && "cube" in datum ? datum.cube : undefined);
            if (datum) {
              onAxis(datum.axis);
            }
          }}
          onSelect={(point) => {
            const datum = point?.datum;
            if (datum) {
              onPin(datum.axis);
            }
          }}
        />
      )}
    </div>
  );
}
