import type { LogEntry } from "@repo/cube/browser";
import { STAT_GROUPS } from "@repo/cube/browser";
import { defineChart, dot, lineY, ruleX } from "@tanstack/charts";
import { decorative } from "@tanstack/charts/mark/decorative";
import { Chart as RendererChart } from "@tanstack/charts/react/core";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { CHART_MOTION, usePlotHeight } from "../insights/charts.tsx";
import { useRemembered } from "../view-choices.ts";
import type { StatGroupName, TimelinePoint } from "./timeline-model.ts";
import {
  DEFAULT_STATS,
  statColor,
  statGroupOf,
  statLabel,
  statOptions,
  timelinePoints,
  toggleStat,
} from "./timeline-model.ts";

const STATS_KEY = "log.timeline.stats";

const statsSchema = z.array(z.string());

export interface TimelineProps {
  entries: readonly LogEntry[];
  active: string | undefined;
  onPick: (id: string) => void;
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function TimelineChart({
  points,
  keys,
  count,
  activeIndex,
  onPick,
}: {
  points: readonly TimelinePoint[];
  keys: readonly string[];
  count: number;
  activeIndex: number | undefined;
  onPick: (id: string) => void;
}): ReactNode {
  const [plot, height] = usePlotHeight();
  const definition = useMemo(() => {
    const values = points.map((point) => point.value);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const pad = high > low ? (high - low) * 0.15 : Math.max(0.1, high * 0.05);
    return defineChart({
      margin: { top: 12, right: 16, bottom: 12, left: 40 },
      marks: [
        ...(activeIndex === undefined
          ? []
          : [
              decorative(
                ruleX([activeIndex], {
                  id: "active",
                  stroke: "var(--accent)",
                  strokeOpacity: 0.8,
                  strokeWidth: 2,
                }),
              ),
            ]),
        ...keys.flatMap((key) => {
          const color = statColor(key, keys);
          const series = points.filter((point) => point.key === key);
          return [
            decorative(lineY(series, { id: `line-${key}`, x: "index", y: "value", stroke: color })),
            dot(
              series.filter((point) => !point.why),
              {
                id: `bare-${key}`,
                key: "id",
                x: "index",
                y: "value",
                r: 3.5,
                fill: "var(--chart-surface)",
                stroke: color,
                strokeWidth: 2,
              },
            ),
            dot(
              series.filter((point) => point.why),
              {
                id: `why-${key}`,
                key: "id",
                x: "index",
                y: "value",
                r: 5.5,
                fill: color,
                stroke: "var(--chart-surface)",
                strokeWidth: 1.5,
              },
            ),
          ];
        }),
      ],
      scales: {
        x: {
          scale: scaleLinear().domain([-0.5, Math.max(0.5, count - 0.5)]),
          axis: false,
        },
        y: {
          scale: scaleLinear().domain([Math.max(0, low - pad), high + pad]),
          nice: true,
          grid: true,
          axis: { line: false, ticks: { size: 0 } },
        },
      },
      tooltip: {
        use: tooltip,
        sticky: false,
        placement: ["top", "bottom"],
        format: (point) => {
          const datum = point.datum;
          return `${datum.subject} · ${datum.label} ${formatValue(datum.value)}`;
        },
      },
      focusRing: false,
    });
  }, [activeIndex, count, keys, points]);
  return (
    <div
      className="chart-plot log-timeline-plot"
      ref={plot}
      data-pickable="true"
      data-active-index={activeIndex}
    >
      <RendererChart
        renderer={CHART_MOTION}
        definition={definition}
        ariaLabel="Stats timeline"
        height={height ?? 200}
        initialWidth={900}
        onSelect={(point) => {
          if (point && "entry" in point.datum) {
            onPick(point.datum.entry);
          }
        }}
      />
    </div>
  );
}

function useHeightVar(name: string) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    const host = element?.parentElement;
    if (!element || !host) {
      return;
    }
    const observer = new ResizeObserver(() => {
      host.style.setProperty(name, `${String(element.offsetHeight)}px`);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      host.style.removeProperty(name);
    };
  }, [name]);
  return ref;
}

export function Timeline({ entries, active, onPick }: TimelineProps): ReactNode {
  const section = useHeightVar("--log-timeline-height");
  const [keys, setKeys] = useRemembered<string[]>(STATS_KEY, [...DEFAULT_STATS], statsSchema);
  const options = useMemo(() => statOptions(entries), [entries]);
  const [group, setGroup] = useState<StatGroupName>(() => statGroupOf(keys[0] ?? "draft"));
  const shown = useMemo(() => {
    const known = new Set([...options.values()].flat().map((option) => option.key));
    return keys.filter((key) => known.has(key));
  }, [keys, options]);
  const points = useMemo(() => timelinePoints(entries, shown), [entries, shown]);
  const index = entries.findIndex((entry) => entry.id === active);
  return (
    <section ref={section} className="log-timeline" aria-label="Stats timeline">
      <div className="log-timeline-groups" role="tablist" aria-label="Stat group">
        {STAT_GROUPS.map(({ trailer }) => {
          const picked = shown.filter((key) => statGroupOf(key) === trailer).length;
          return (
            <button
              key={trailer}
              type="button"
              role="tab"
              aria-selected={group === trailer}
              onClick={() => {
                setGroup(trailer);
              }}
            >
              {trailer}
              {picked > 0 && <span className="log-timeline-count">{picked}</span>}
            </button>
          );
        })}
      </div>
      <div className="log-timeline-stats" aria-label={`${group} stats`}>
        {(options.get(group) ?? []).map((option) => (
          <label key={option.key} className="log-timeline-stat">
            <input
              type="checkbox"
              checked={keys.includes(option.key)}
              onChange={() => {
                setKeys(toggleStat(keys, option.key));
              }}
            />
            <span
              className="log-timeline-swatch"
              style={{ background: statColor(option.key, shown) }}
              hidden={!keys.includes(option.key)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="muted">Pick a stat to plot.</p>
      ) : (
        <>
          <TimelineChart
            points={points}
            keys={shown}
            count={entries.length}
            activeIndex={index === -1 ? undefined : index}
            onPick={onPick}
          />
          <p className="log-timeline-legend muted">
            {shown.map((key) => (
              <span key={key}>
                <span
                  className="log-timeline-swatch"
                  style={{ background: statColor(key, shown) }}
                />
                {statGroupOf(key) === "Counts"
                  ? statLabel(key)
                  : `${statGroupOf(key)} ${statLabel(key)}`}
              </span>
            ))}
            <span className="log-timeline-key">● with a why ○ without</span>
          </p>
        </>
      )}
    </section>
  );
}
