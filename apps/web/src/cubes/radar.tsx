import type { CompareUnit, GroupRow } from "@repo/cube/browser";
import { defineChart } from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import {
  focusGroupAngle,
  polar,
  radialArea,
  radialDot,
  radialLine,
  radialRule,
  radialText,
} from "@tanstack/charts/polar";
import { Chart } from "@tanstack/charts/react/core";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { curveLinearClosed } from "d3-shape";
import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { PinIcon } from "../icons.tsx";
import { CHART_MOTION, usePlotHeight } from "../insights/charts.tsx";
import { OUTLIER, PERCENT } from "./model.ts";
import type { OutlinePoint } from "./outline.ts";
import { outline } from "./outline.ts";
import type { StatRow } from "./rows.tsx";

const HERO_RATIO = 0.66;
const TILE_RATIO = 0.86;
const SHARE_STEPS = [0.05, 0.1, 0.2, 0.25];
const COUNT_STEPS = [1, 2, 5, 10, 20, 25, 50, 100];
const MAX_RINGS = 5;
const LABEL_GAP = 16;
const SIDE_LIMIT = 0.2;
const VERT_LIMIT = 0.75;
const RING_FONT = 10;

export interface RadarCube {
  name: string;
  hue: string;
}

interface Vertex {
  id: string;
  cube: number;
  axis: string;
  turn: number;
  value: number;
  delta: number;
}

interface Traced extends OutlinePoint {
  id: string;
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

function traced(prefix: string, radii: readonly number[]): Traced[] {
  return outline(radii).map((point, index) => ({ ...point, id: `${prefix}:${String(index)}` }));
}

function radarDefinition({ rows, cubes, unit, tile }: RadarInput) {
  const count = rows.length;
  const vertices: Vertex[][] = cubes.map((_, cube) =>
    rows.map((row, index) => {
      const cell = row.cells[cube] ?? { count: 0, share: 0, delta: 0 };
      return {
        id: `${String(cube)}:${row.id}`,
        cube,
        axis: row.id,
        turn: index / count,
        value: unit === "share" ? cell.share : cell.count,
        delta: cell.delta,
      };
    }),
  );
  const means = rows.map((row) => meanOf(row, unit));
  const rings = ringsFor(
    Math.max(...vertices.flat().map((vertex) => vertex.value), ...means),
    unit,
  );
  const top = rings.at(-1) ?? 1;
  const scales = {
    angle: { scale: scaleLinear().domain([0, 1]) },
    radius: { scale: scaleLinear().domain([0, top]) },
  };
  const radiusRatio = tile ? TILE_RATIO : HERO_RATIO;
  const spokes = rows.map((_, index) => ({ id: `spoke:${String(index)}`, turn: index / count }));
  const ringLabels = rings.map((value, index) => ({
    id: `ring:${String(index)}`,
    turn: 0.5 / count,
    radius: value * Math.cos(Math.PI / count),
    text: amount(value, unit),
  }));
  return defineChart({
    motion: { path: "morph" },
    marks: [
      decorative(
        polar({
          id: "paint",
          radiusRatio,
          scales,
          marks: [
            radialRule(spokes, {
              id: "spokes",
              angle: "turn",
              radius2: top,
              key: "id",
              stroke: "var(--radar-grid)",
            }),
            ...rings.map((value, index) =>
              radialLine(
                traced(
                  `ring:${String(index)}`,
                  rows.map(() => value),
                ),
                {
                  id: `ring-${String(index)}`,
                  angle: "turn",
                  radius: "radius",
                  key: "id",
                  curve: curveLinearClosed,
                  stroke: "var(--radar-grid)",
                  strokeWidth: 1,
                },
              ),
            ),
            ...vertices.map((points, cube) =>
              radialArea(
                traced(
                  `cube:${String(cube)}`,
                  points.map((vertex) => vertex.value),
                ),
                {
                  id: `area-${String(cube)}`,
                  className: `radar-cube radar-cube-${String(cube)}`,
                  angle: "turn",
                  radius: "radius",
                  key: "id",
                  curve: curveLinearClosed,
                  fill: cubes[cube]?.hue ?? "currentColor",
                  fillOpacity: 0.16,
                  stroke: cubes[cube]?.hue ?? "currentColor",
                  strokeWidth: tile ? 1.5 : 2,
                },
              ),
            ),
            radialLine(traced("mean", means), {
              id: "mean",
              className: "radar-mean",
              angle: "turn",
              radius: "radius",
              key: "id",
              curve: curveLinearClosed,
              stroke: "var(--fg)",
              strokeWidth: 1.4,
              strokeDasharray: "4 4",
            }),
            ...vertices.map((points, cube) =>
              radialDot(
                points.filter((vertex) => Math.abs(vertex.delta) >= OUTLIER),
                {
                  id: `outliers-${String(cube)}`,
                  className: `radar-cube radar-cube-${String(cube)}`,
                  angle: "turn",
                  radius: "value",
                  key: "id",
                  r: tile ? 3 : 5,
                  fill: cubes[cube]?.hue ?? "currentColor",
                  stroke: "var(--panel)",
                  strokeWidth: 2,
                },
              ),
            ),
            ...(tile
              ? []
              : [
                  radialText(ringLabels, {
                    id: "ring-labels",
                    angle: "turn",
                    radius: "radius",
                    key: "id",
                    text: "text",
                    fill: "var(--muted)",
                    fontSize: RING_FONT,
                    anchor: "middle",
                    baseline: "middle",
                  }),
                ]),
          ],
        }),
      ),
      polar({
        id: "focus",
        radiusRatio,
        scales,
        marks: vertices.map((points, cube) =>
          radialDot(points, {
            id: `vertices-${String(cube)}`,
            angle: "turn",
            radius: "value",
            key: "id",
            r: tile ? 3 : 5,
            opacity: 0,
          }),
        ),
      }),
    ],
    scales: { x: null, y: null },
    focus: focusGroupAngle,
    keyboard: false,
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
  armed,
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
  armed: boolean;
  onAxis: (axis: string | undefined) => void;
  onPin: (axis: string) => void;
  onHotCube: (cube: number | undefined) => void;
}): ReactNode {
  const labels = useRef<HTMLOListElement>(null);
  const onLabel = useRef<string | undefined>(undefined);
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
        const rise = Math.cos(angle);
        element.dataset["vert"] =
          rise > VERT_LIMIT ? "top" : rise < -VERT_LIMIT ? "bottom" : "middle";
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
        onLabel.current = undefined;
        onHotCube(undefined);
        onAxis(undefined);
      }}
    >
      <ol ref={labels} className="cubes-radar-labels" aria-label={`${title} spokes`}>
        {rows.map((row, index) => {
          const spec = specs.get(row.id);
          const label = spec?.label ?? row.id;
          const pinned = pins.has(row.id);
          const hovered = hover === row.id;
          const enter = (): void => {
            onLabel.current = row.id;
            onHotCube(undefined);
            onAxis(row.id);
          };
          const leave = (): void => {
            onLabel.current = undefined;
            onAxis(undefined);
          };
          return (
            <li key={row.id}>
              <button
                type="button"
                aria-pressed={pinned}
                aria-label={`${pinned ? "Unpin" : "Pin"} ${label}${mixed && spec ? ` (${spec.section})` : ""}`}
                data-hover={hovered ? "" : undefined}
                data-intent={hovered && armed ? (pinned ? "unpin" : "pin") : undefined}
                onPointerEnter={enter}
                onPointerLeave={leave}
                onFocus={enter}
                onBlur={leave}
                onClick={() => {
                  onPin(row.id);
                }}
              >
                {mixed && <b className="cubes-label-index">{index + 1}</b>}
                {spec?.icon}
                <span className={spec?.iconOnly ? "sr-only" : undefined}>{label}</span>
                {mixed && spec && <small>{spec.section}</small>}
                <span className="cubes-label-pin" aria-hidden="true">
                  <PinIcon size={12} />
                </span>
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
            if (onLabel.current !== undefined) {
              return;
            }
            const datum = point?.datum;
            onHotCube(datum && "cube" in datum ? datum.cube : undefined);
            onAxis(datum?.axis);
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
