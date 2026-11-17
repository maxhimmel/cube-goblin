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
import { tooltip } from "@tanstack/charts/tooltip";
import { curveLinearClosed } from "d3-shape";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { CHART_MOTION } from "../insights/charts.tsx";
import type { StatRow } from "./rows.tsx";

export const RADIUS_RATIO = 0.7;
const PERCENT = 100;
const OUTLIER = 0.05;
const SIZE = 420;

export interface RadarCube {
  name: string;
  hue: string;
}

interface Point {
  id: string;
  cube: number;
  axis: string;
  value: number;
  share: number;
  count: number;
  delta: number;
  mean: number;
}

interface Mean {
  id: string;
  axis: string;
  value: number;
}

const SHARE_STEPS = [0.05, 0.1, 0.2, 0.25];
const COUNT_STEPS = [1, 2, 5, 10, 20, 25, 50, 100];
const MAX_RINGS = 5;

function ringsFor(peak: number, unit: CompareUnit): number[] {
  const steps = unit === "share" ? SHARE_STEPS : COUNT_STEPS;
  const step = steps.find((candidate) => peak / candidate <= MAX_RINGS) ?? steps.at(-1) ?? 1;
  const count = Math.max(1, Math.ceil(peak / step - 1e-9));
  return Array.from({ length: count }, (_, index) => step * (index + 1));
}

function amount(value: number, unit: CompareUnit): string {
  return unit === "share" ? `${String(Math.round(value * PERCENT))}%` : String(Math.round(value));
}

function points(delta: number): string {
  const rounded = Math.round(delta * PERCENT);
  return `${rounded > 0 ? "+" : ""}${String(rounded)} pts`;
}

interface Scene {
  scene: { chart: { x: number; y: number; width?: number; height: number } };
}

interface RadarInput {
  rows: readonly GroupRow[];
  axisLabels: Readonly<Record<string, string>>;
  cubes: readonly RadarCube[];
  unit: CompareUnit;
}

function radarDefinition({ rows, axisLabels, cubes, unit }: RadarInput) {
  const axes = rows.map((row) => row.id);
  const meanOf = (row: GroupRow): number =>
    unit === "share"
      ? row.mean
      : row.cells.reduce((sum, cell) => sum + cell.count, 0) / Math.max(1, row.cells.length);
  const series: Point[][] = cubes.map((_, cube) =>
    rows.map((row) => {
      const cell = row.cells[cube] ?? { count: 0, share: 0, delta: 0 };
      return {
        id: `${String(cube)}:${row.id}`,
        cube,
        axis: row.id,
        value: unit === "share" ? cell.share : cell.count,
        share: cell.share,
        count: cell.count,
        delta: cell.delta,
        mean: row.mean,
      };
    }),
  );
  const means: Mean[] = rows.map((row) => ({
    id: `mean:${row.id}`,
    axis: row.id,
    value: meanOf(row),
  }));
  const rings = ringsFor(
    Math.max(...series.flat().map((point) => point.value), ...means.map((mean) => mean.value)),
    unit,
  );
  const top = rings.at(-1) ?? 1;
  return defineChart({
    marks: [
      polar({
        radiusRatio: RADIUS_RATIO,
        scales: {
          angle: { scale: scalePoint().domain(axes), wrap: true },
          radius: { scale: scaleLinear().domain([0, top]) },
        },
        guides: [
          radialGrid({
            values: rings,
            shape: "polygon",
            stroke: "var(--radar-grid)",
            labels: true,
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
              strokeWidth: 2,
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
            strokeWidth: 1.5,
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
                r: 5,
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
    tooltip: {
      use: tooltip,
      sticky: false,
      className: "cubes-tip",
      formatGroup: (focused) => {
        const first = focused[0]?.datum;
        const axis = first ? (axisLabels[first.axis] ?? first.axis) : "";
        const lines = series.flatMap((cubePoints) => {
          const datum = first && cubePoints.find((point) => point.axis === first.axis);
          if (!datum) {
            return [];
          }
          const off = Math.abs(datum.delta) >= OUTLIER ? `  ${points(datum.delta)}` : "";
          return [
            `${cubes[datum.cube]?.name ?? ""}: ${amount(datum.value, unit)} (${String(datum.count)} cards)${off}`,
          ];
        });
        const mean = first ? means.find((entry) => entry.axis === first.axis) : undefined;
        return [axis, ...lines, mean ? `Average: ${amount(mean.value, unit)}` : ""]
          .filter((line) => line !== "")
          .join("\n");
      },
    },
  });
}

export function Radar({
  title,
  rows,
  specs,
  cubes,
  unit,
  onHotCube,
}: {
  title: string;
  rows: readonly GroupRow[];
  specs: ReadonlyMap<string, StatRow>;
  cubes: readonly RadarCube[];
  unit: CompareUnit;
  onHotCube: (cube: number | undefined) => void;
}): ReactNode {
  const labels = useRef<HTMLOListElement>(null);
  const axes = rows.map((row) => row.id);
  const axisLabels = Object.fromEntries(
    rows.map((row) => [row.id, specs.get(row.id)?.label ?? row.id]),
  );
  const input: RadarInput = { rows, axisLabels, cubes, unit };
  const key = JSON.stringify([rows, axisLabels, cubes, unit]);
  const [held, setHeld] = useState({ key, input });
  if (held.key !== key) {
    setHeld({ key, input });
  }
  const definition = useMemo(() => radarDefinition(held.input), [held]);
  const place = useCallback(
    ({ scene }: Scene) => {
      const layer = labels.current;
      if (!layer) {
        return;
      }
      const width = scene.chart.width ?? 0;
      const cx = scene.chart.x + width / 2;
      const cy = scene.chart.y + scene.chart.height / 2;
      const reach = (Math.min(width, scene.chart.height) / 2) * RADIUS_RATIO + 18;
      Array.from(layer.children).forEach((element, index) => {
        if (!(element instanceof HTMLElement)) {
          return;
        }
        const angle = (index / Math.max(1, axes.length)) * Math.PI * 2;
        const x = cx + Math.sin(angle) * reach;
        const y = cy - Math.cos(angle) * reach;
        element.style.left = `${String(x)}px`;
        element.style.top = `${String(y)}px`;
        element.dataset["side"] =
          Math.abs(Math.sin(angle)) < 0.2 ? "middle" : Math.sin(angle) > 0 ? "right" : "left";
      });
      layer.dataset["ready"] = "true";
    },
    [axes.length],
  );
  return (
    <div
      className="cubes-radar"
      onPointerLeave={() => {
        onHotCube(undefined);
      }}
    >
      <ol ref={labels} className="cubes-radar-labels" aria-hidden="true">
        {rows.map((row) => {
          const spec = specs.get(row.id);
          return (
            <li key={row.id}>
              {spec?.icon}
              <span>{spec?.label ?? row.id}</span>
            </li>
          );
        })}
      </ol>
      <Chart
        renderer={CHART_MOTION}
        definition={definition}
        ariaLabel={`${title}: ${cubes.map((cube) => cube.name).join(", ")} against their average`}
        height={SIZE}
        initialWidth={SIZE}
        onRender={place}
        onFocusChange={(point) => {
          const datum = point?.datum;
          onHotCube(datum && "cube" in datum ? datum.cube : undefined);
        }}
      />
    </div>
  );
}
