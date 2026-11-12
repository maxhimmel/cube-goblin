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
import type { StatGroupName, StatOption, TimelineMode, TimelinePoint } from "./timeline-model.ts";
import {
  DEFAULT_STATS,
  TIMELINE_MODES,
  setStats,
  statRange,
  statColor,
  statGroupOf,
  statLabel,
  statOptions,
  timelinePoints,
} from "./timeline-model.ts";

const STATS_KEY = "log.timeline.stats";

const MODE_KEY = "log.timeline.mode";

const statsSchema = z.array(z.string());

const modeSchema = z.enum(TIMELINE_MODES);

const MODE_LABELS: Record<TimelineMode, string> = { change: "Change", values: "Values" };

export interface TimelineProps {
  entries: readonly LogEntry[];
  active: string | undefined;
  onPick: (id: string) => void;
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatChange(value: number): string {
  const text = formatValue(Math.abs(value));
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : "±0";
}

function TimelineChart({
  points,
  keys,
  count,
  activeIndex,
  mode,
  onPick,
}: {
  points: readonly TimelinePoint[];
  keys: readonly string[];
  count: number;
  mode: TimelineMode;
  activeIndex: number | undefined;
  onPick: (id: string) => void;
}): ReactNode {
  const [plot, height] = usePlotHeight();
  const definition = useMemo(() => {
    const values = [...points.map((point) => point.value), ...(mode === "change" ? [0] : [])];
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
          scale: scaleLinear().domain([
            mode === "change" ? low - pad : Math.max(0, low - pad),
            high + pad,
          ]),
          nice: true,
          grid: true,
          axis: {
            line: false,
            ticks: {
              size: 0,
              ...(mode === "change" ? { format: (value: number) => formatChange(value) } : {}),
            },
          },
        },
      },
      tooltip: {
        use: tooltip,
        sticky: false,
        placement: ["top", "bottom"],
        format: (point) => {
          const datum = point.datum;
          const change = mode === "change" ? ` (${formatChange(datum.value)})` : "";
          return `${datum.subject} · ${datum.label} ${formatValue(datum.raw)}${change}`;
        },
      },
      focusRing: false,
    });
  }, [activeIndex, count, keys, mode, points]);
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

function StatPicker({
  group,
  options,
  keys,
  shown,
  onChange,
}: {
  group: StatGroupName;
  options: readonly StatOption[];
  keys: readonly string[];
  shown: readonly string[];
  onChange: (keys: string[]) => void;
}): ReactNode {
  const anchor = useRef<string | undefined>(undefined);
  const latest = useRef(keys);
  const pressed = useRef(false);
  useEffect(() => {
    latest.current = keys;
  }, [keys]);
  const change = (next: string[]) => {
    latest.current = next;
    onChange(next);
  };
  const [paint, setPaint] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    const release = () => {
      window.setTimeout(() => {
        pressed.current = false;
      });
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);
  useEffect(() => {
    if (paint === undefined) {
      return;
    }
    const stop = () => {
      setPaint(undefined);
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [paint]);
  const press = (key: string, modifiers: { shiftKey: boolean; altKey: boolean }): boolean => {
    const current = latest.current;
    const on = !current.includes(key);
    if (modifiers.altKey) {
      change([key]);
    } else if (modifiers.shiftKey && anchor.current !== undefined) {
      change(setStats(current, statRange(options, anchor.current, key), on));
    } else {
      change(setStats(current, [key], on));
    }
    anchor.current = key;
    return on;
  };
  return (
    <div
      className="log-timeline-stats"
      aria-label={`${group} stats`}
      data-painting={paint !== undefined}
    >
      {options.map((option) => {
        const checked = keys.includes(option.key);
        return (
          <label
            key={option.key}
            className="log-timeline-stat"
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              event.preventDefault();
              pressed.current = true;
              const on = press(option.key, event);
              if (!event.shiftKey && !event.altKey) {
                setPaint(on);
              }
            }}
            onPointerEnter={() => {
              if (paint !== undefined) {
                const from = anchor.current ?? option.key;
                change(setStats(latest.current, statRange(options, from, option.key), paint));
                anchor.current = option.key;
              }
            }}
            onClick={(event) => {
              if (pressed.current) {
                event.preventDefault();
              }
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                if (pressed.current) {
                  return;
                }
                press(option.key, { shiftKey: false, altKey: false });
              }}
            />
            {option.label}
            <span
              className="log-timeline-swatch"
              style={{ background: statColor(option.key, shown) }}
              data-off={!checked}
            />
          </label>
        );
      })}
    </div>
  );
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
  const [mode, setMode] = useRemembered<TimelineMode>(MODE_KEY, "change", modeSchema);
  const points = useMemo(() => timelinePoints(entries, shown, mode), [entries, shown, mode]);
  const groupOptions = options.get(group) ?? [];
  const groupKeys = groupOptions.map((option) => option.key);
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
      <div className="log-timeline-tools">
        <button
          type="button"
          onClick={() => {
            setKeys(setStats(keys, groupKeys, true));
          }}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => {
            setKeys(setStats(keys, groupKeys, false));
          }}
        >
          None
        </button>
        <span className="log-timeline-hint muted">
          Drag across to set several · Shift-click for a range · Alt-click for only one
        </span>
        <span className="log-timeline-modes" role="group" aria-label="Plot">
          {TIMELINE_MODES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => {
                setMode(item);
              }}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </span>
      </div>
      <StatPicker
        group={group}
        options={groupOptions}
        keys={keys}
        shown={shown}
        onChange={setKeys}
      />
      {shown.length === 0 ? (
        <p className="muted">Pick a stat to plot.</p>
      ) : (
        <>
          <TimelineChart
            points={points}
            keys={shown}
            count={entries.length}
            activeIndex={index === -1 ? undefined : index}
            mode={mode}
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
