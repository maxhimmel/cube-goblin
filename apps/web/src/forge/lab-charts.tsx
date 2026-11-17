import { colorKey } from "@repo/cube/browser";
import type { CSSProperties, ReactNode } from "react";
import { colorLabel, ptLabel } from "../insights/labels.tsx";
import type { GridCard } from "../modes/mode.ts";
import type { BalanceRow, HeatRow, Matchups, Tally, Test, Used } from "./model.ts";
import {
  MATCHUP_CORNERS,
  PT_AXIS,
  ghostLabel,
  isCreatureCard,
  ptCell,
  refLabel,
  scaleTop,
} from "./model.ts";

export interface ChartEvents {
  onPeek: (key: string | undefined) => void;
  onPick: (key: string) => void;
  baseline: boolean;
  filtered: boolean;
  picked: ReadonlySet<string>;
  against?: string | undefined;
}

const MANA_VAR: Record<string, string> = {
  W: "var(--mana-w)",
  U: "var(--mana-u)",
  B: "var(--mana-b)",
  R: "var(--mana-r)",
  G: "var(--mana-g)",
  M: "var(--mana-m)",
  C: "var(--mana-c)",
  multicolored: "var(--mana-m)",
  colorless: "var(--mana-c)",
};

export function manaVar(id: string): string | undefined {
  return MANA_VAR[id];
}

function peekProps(key: string, events: ChartEvents) {
  return {
    "data-picked": events.picked.has(key) ? "" : undefined,
    onPointerEnter: () => {
      events.onPeek(key);
    },
    onPointerLeave: () => {
      events.onPeek(undefined);
    },
    onFocus: () => {
      events.onPeek(key);
    },
    onBlur: () => {
      events.onPeek(undefined);
    },
    onClick: () => {
      events.onPick(key);
    },
  };
}

function inertUnless(live: boolean, key: string, events: ChartEvents) {
  return live ? peekProps(key, events) : { tabIndex: -1, "aria-disabled": true };
}

function curveId(tally: Tally): string {
  return tally.id.split(":").at(-1) ?? "";
}

type RefDirection = "more" | "less" | "even";

const EVEN_WITHIN = 0.5;

const HEAT_EVEN_WITHIN = 1;

function refDirection(row: Tally): RefDirection | undefined {
  if (row.ref === undefined) {
    return undefined;
  }
  const diff = row.hit - row.ref;
  return Math.abs(diff) < EVEN_WITHIN ? "even" : diff > 0 ? "more" : "less";
}

function refSpoken(row: Tally, events: ChartEvents): string {
  return row.ref === undefined || events.against === undefined
    ? ""
    : `, ${events.against} ${refLabel(row.ref)}`;
}

function refTitle(row: Tally, events: ChartEvents): string | undefined {
  return row.ref === undefined || events.against === undefined
    ? undefined
    : `${row.label}: ${String(row.hit)} here, ${refLabel(row.ref)} in ${events.against}`;
}

function RefNote({ row }: { row: Tally }): ReactNode {
  if (row.ref === undefined) {
    return null;
  }
  return (
    <span className="lab-ref-note" data-dir={refDirection(row)}>
      vs {refLabel(row.ref)}
    </span>
  );
}

function Ghost({ delta, faint }: { delta: number; faint?: boolean }): ReactNode {
  return (
    <em
      className="lab-ghost-label"
      data-down={delta < 0 ? "" : undefined}
      data-faint={faint ? "" : undefined}
    >
      {ghostLabel(delta)}
    </em>
  );
}

export function CurveBars({
  tallies,
  events,
  used,
}: {
  tallies: readonly Tally[];
  events: ChartEvents;
  used?: Used | undefined;
}): ReactNode {
  const rows = tallies.filter(
    (row) => !used || used.curve.has(curveId(row)) || row.baseGhost !== 0,
  );
  const top = scaleTop(rows, events.baseline || !events.filtered);
  const pct = (value: number): string => `${String((value / top) * 100)}%`;
  return (
    <div className="lab-bars" role="list" aria-label="Mana curve">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          role="listitem"
          className="lab-bar"
          data-ghost={row.ghost === 0 ? undefined : row.ghost > 0 ? "up" : "down"}
          aria-label={`MV ${row.label}: ${String(row.hit)} of ${String(row.base)}${refSpoken(row, events)}`}
          title={refTitle(row, events)}
          data-ref={refDirection(row)}
          {...peekProps(row.id, events)}
        >
          <span className="lab-bar-value">
            {row.hit}
            {row.ghost !== 0 && <Ghost delta={row.ghost} />}
            {row.ghost === 0 && row.baseGhost !== 0 && events.baseline && (
              <Ghost delta={row.baseGhost} faint />
            )}
          </span>
          <span className="lab-bar-track">
            {events.baseline && events.filtered && (
              <span className="lab-bar-base" style={{ height: pct(row.base) }} />
            )}
            {events.baseline && events.filtered && row.ghost === 0 && row.baseGhost !== 0 && (
              <span
                className="lab-bar-base-ghost"
                data-down={row.baseGhost < 0 ? "" : undefined}
                style={{
                  bottom: pct(Math.min(row.base, row.base + row.baseGhost)),
                  height: pct(Math.abs(row.baseGhost)),
                }}
              />
            )}
            <span className="lab-bar-fill" style={{ height: pct(row.hit) }} />
            {row.ghost > 0 && (
              <span
                className="lab-bar-ghost"
                style={{ bottom: pct(row.hit), height: pct(row.ghost) }}
              />
            )}
            {row.ghost < 0 && (
              <span
                className="lab-bar-loss"
                style={{ bottom: pct(row.hit + row.ghost), height: pct(-row.ghost) }}
              />
            )}
            {row.ref !== undefined && row.ref > 0 && (
              <span className="lab-ref-tick" data-axis="y" style={{ bottom: pct(row.ref) }} />
            )}
          </span>
          <span className="lab-bar-label">{row.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Heat({
  rows,
  events,
  used,
}: {
  rows: readonly HeatRow[];
  events: ChartEvents;
  used?: Used | undefined;
}): ReactNode {
  const ghosted = (row: HeatRow): boolean => row.cells.some((cell) => cell.baseGhost !== 0);
  const shownRows = rows.filter((row) => !used || used.colors.has(row.id) || ghosted(row));
  const columns = (rows[0]?.cells ?? [])
    .map((cell, index) => ({ id: curveId(cell), label: cell.label, index }))
    .filter(
      ({ id, index }) =>
        !used || used.curve.has(id) || rows.some((row) => row.cells[index]?.baseGhost !== 0),
    );
  const top = Math.max(1, ...rows.flatMap((row) => row.cells.map((cell) => cell.base)));
  return (
    <div
      className="lab-heat"
      style={{ "--heat-columns": columns.length } as CSSProperties}
      role="table"
      aria-label="Color by mana value"
    >
      <span />
      {columns.map(({ id, label }) => (
        <span key={id} className="lab-heat-head">
          {label}
        </span>
      ))}
      {shownRows.map((row) => (
        <div key={row.id} className="lab-heat-row" role="row">
          <span
            className="lab-heat-color"
            title={colorLabel(row.id)}
            style={{ "--swatch": MANA_VAR[row.id] } as CSSProperties}
          />
          {columns.map(({ index }) => {
            const cell = row.cells[index];
            if (!cell) {
              return null;
            }
            const share = cell.base === 0 ? 0 : cell.hit / cell.base;
            const shown = events.filtered ? cell.hit : cell.base;
            const blank =
              cell.ghost === 0 &&
              (events.baseline ? cell.base === 0 && cell.baseGhost === 0 : shown === 0);
            return (
              <button
                key={cell.id}
                type="button"
                className="lab-heat-cell"
                data-empty={blank ? "" : undefined}
                data-ghost={cell.ghost === 0 ? undefined : cell.ghost > 0 ? "up" : "down"}
                data-base-ghost={
                  cell.ghost === 0 && cell.baseGhost !== 0 && events.baseline ? "" : undefined
                }
                aria-label={`${row.label}, MV ${cell.label}: ${String(cell.hit)}${refSpoken(cell, events)}`}
                title={refTitle(cell, events)}
                data-ref={
                  Math.abs(cell.hit - (cell.ref ?? cell.hit)) < HEAT_EVEN_WITHIN
                    ? undefined
                    : refDirection(cell)
                }
                style={
                  {
                    "--heat": String(cell.base / top),
                    "--share": String(events.filtered ? share : 1),
                    "--swatch": MANA_VAR[row.id],
                  } as CSSProperties
                }
                {...inertUnless(!blank, cell.id, events)}
              >
                {events.baseline && events.filtered && cell.base > 0 && (
                  <span className="lab-heat-base" />
                )}
                <span className="lab-heat-fill" />
                <span className="lab-heat-count">{shown > 0 ? shown : ""}</span>
                {cell.ghost !== 0 && <Ghost delta={cell.ghost} />}
                {cell.ghost === 0 && cell.baseGhost !== 0 && events.baseline && (
                  <Ghost delta={cell.baseGhost} faint />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function PtDots({
  scope,
  next,
  lens,
  events,
  used,
}: {
  scope: readonly GridCard[];
  next: readonly GridCard[];
  lens: Test | undefined;
  events: ChartEvents;
  used?: Used | undefined;
}): ReactNode {
  const now = new Set(scope.map((card) => card.slug));
  const later = new Set(next.map((card) => card.slug));
  const creatures = [...new Map([...scope, ...next].map((card) => [card.slug, card])).values()]
    .filter(isCreatureCard)
    .toSorted((a, b) => colorKey(a).localeCompare(colorKey(b)));
  const seen = (pick: (card: GridCard) => string | undefined): Set<string> =>
    new Set(creatures.flatMap((card) => pick(card) ?? []));
  const powerSeen = seen((card) => ptCell(card.power));
  const toughSeen = seen((card) => ptCell(card.toughness));
  const toughness = PT_AXIS.filter((id) => !used || used.toughness.has(id) || toughSeen.has(id));
  const powers = PT_AXIS.filter(
    (id) => !used || used.power.has(id) || powerSeen.has(id),
  ).toReversed();
  return (
    <div
      className="lab-pt"
      style={{ "--pt-columns": toughness.length } as CSSProperties}
      aria-label="Creature power by toughness"
    >
      {powers.map((power) => (
        <div key={power} className="lab-pt-row">
          <span className="lab-pt-axis">{ptLabel(power)}</span>
          {toughness.map((tough) => {
            const here = creatures.filter(
              (card) => ptCell(card.power) === power && ptCell(card.toughness) === tough,
            );
            const key = `pt:${power}:${tough}`;
            const dots = here
              .map((card) => ({
                card,
                state:
                  now.has(card.slug) && !later.has(card.slug)
                    ? "leaving"
                    : !now.has(card.slug)
                      ? "arriving"
                      : lens && !lens(card)
                        ? "faint"
                        : "hit",
              }))
              .filter(({ state }) => state !== "faint" || events.baseline);
            return (
              <button
                key={tough}
                type="button"
                className="lab-pt-cell"
                aria-label={`${ptLabel(power)}/${ptLabel(tough)}: ${String(here.length)}`}
                data-empty={dots.length === 0 ? "" : undefined}
                {...inertUnless(dots.length > 0, key, events)}
              >
                {dots.map(({ card, state }) => {
                  return (
                    <i
                      key={card.slug}
                      data-state={state}
                      title={card.name}
                      style={{ "--dot": MANA_VAR[colorKey(card)] } as CSSProperties}
                    />
                  );
                })}
              </button>
            );
          })}
        </div>
      ))}
      <div className="lab-pt-row lab-pt-foot">
        <span className="lab-pt-axis" title="Power up, toughness across">
          P/T
        </span>
        {toughness.map((tough) => (
          <span key={tough} className="lab-pt-axis">
            {ptLabel(tough)}
          </span>
        ))}
      </div>
    </div>
  );
}

function shown(row: Tally): boolean {
  return (
    row.base > 0 || row.baseGhost !== 0 || row.hit > 0 || row.ghost !== 0 || (row.ref ?? 0) > 0
  );
}

export function BarList({
  name,
  tallies,
  events,
  swatch,
  icon,
}: {
  name: string;
  tallies: readonly Tally[];
  events: ChartEvents;
  swatch?: ((id: string) => string | undefined) | undefined;
  icon?: ((id: string) => ReactNode) | undefined;
}): ReactNode {
  const rows = tallies.filter(shown);
  const top = scaleTop(rows, events.baseline || !events.filtered);
  const pct = (value: number): string => `${String((value / top) * 100)}%`;
  const key = (row: Tally): string => row.id.split(":").slice(1).join(":");
  if (rows.length === 0) {
    return <p className="lab-empty">None in this scope</p>;
  }
  return (
    <div className="lab-hbars" role="list" aria-label={name}>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          role="listitem"
          className="lab-hbar"
          data-ghost={row.ghost === 0 ? undefined : row.ghost > 0 ? "up" : "down"}
          aria-label={`${row.label}: ${String(row.hit)} of ${String(row.base)}${refSpoken(row, events)}`}
          title={refTitle(row, events)}
          data-ref={refDirection(row)}
          style={{ "--swatch": swatch?.(key(row)) ?? "var(--lab-hit)" } as CSSProperties}
          {...peekProps(row.id, events)}
        >
          <span className="lab-hbar-label">
            {icon?.(key(row))}
            <span>{row.label}</span>
          </span>
          <span className="lab-hbar-track">
            {events.baseline && events.filtered && (
              <span className="lab-hbar-base" style={{ width: pct(row.base) }} />
            )}
            {events.baseline && events.filtered && row.ghost === 0 && row.baseGhost !== 0 && (
              <span
                className="lab-hbar-base-ghost"
                data-down={row.baseGhost < 0 ? "" : undefined}
                style={{
                  left: pct(Math.min(row.base, row.base + row.baseGhost)),
                  width: pct(Math.abs(row.baseGhost)),
                }}
              />
            )}
            <span className="lab-hbar-fill" style={{ width: pct(row.hit) }} />
            {row.ghost > 0 && (
              <span
                className="lab-hbar-ghost"
                style={{ left: pct(row.hit), width: pct(row.ghost) }}
              />
            )}
            {row.ghost < 0 && (
              <span
                className="lab-hbar-loss"
                style={{ left: pct(row.hit + row.ghost), width: pct(-row.ghost) }}
              />
            )}
            {row.ref !== undefined && row.ref > 0 && (
              <span className="lab-ref-tick" data-axis="x" style={{ left: pct(row.ref) }} />
            )}
          </span>
          <span className="lab-hbar-value">
            {events.filtered && events.baseline
              ? `${String(row.hit)}/${String(row.base)}`
              : row.hit}
            {row.ghost !== 0 && <Ghost delta={row.ghost} />}
            {row.ghost === 0 && row.baseGhost !== 0 && events.baseline && (
              <Ghost delta={row.baseGhost} faint />
            )}
            <RefNote row={row} />
          </span>
        </button>
      ))}
    </div>
  );
}

export function SummaryTiles({
  tallies,
  events,
}: {
  tallies: readonly Tally[];
  events: ChartEvents;
}): ReactNode {
  return (
    <div className="lab-tiles" role="list" aria-label="Summary">
      {tallies.map((row) => {
        const pickable = row.id.includes(":");
        const body = (
          <>
            <span className="lab-stat-label">{row.label}</span>
            <strong className="lab-stat-value">
              {row.hit}
              {events.filtered && <span className="lab-stat-base">/{row.base}</span>}
            </strong>
            {row.ghost !== 0 && <Ghost delta={row.ghost} />}
            {row.ghost === 0 && row.baseGhost !== 0 && events.baseline && (
              <Ghost delta={row.baseGhost} faint />
            )}
            <RefNote row={row} />
          </>
        );
        return pickable ? (
          <button
            key={row.id}
            type="button"
            role="listitem"
            className="lab-stat"
            title={refTitle(row, events)}
            aria-label={`${row.label}: ${String(row.hit)}${refSpoken(row, events)}`}
            {...peekProps(row.id, events)}
          >
            {body}
          </button>
        ) : (
          <div
            key={row.id}
            role="listitem"
            className="lab-stat"
            title={refTitle(row, events)}
            aria-label={`${row.label}: ${String(row.hit)}${refSpoken(row, events)}`}
          >
            {body}
          </div>
        );
      })}
    </div>
  );
}

export function TagChips({
  name,
  tallies,
  events,
}: {
  name: string;
  tallies: readonly Tally[];
  events: ChartEvents;
}): ReactNode {
  const rows = tallies.filter(shown);
  if (rows.length === 0) {
    return <p className="lab-empty">None in this scope</p>;
  }
  return (
    <div className="toggle-chips" role="list" aria-label={name}>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          role="listitem"
          className="toggle-chip"
          data-ghost={row.ghost === 0 ? undefined : row.ghost > 0 ? "up" : "down"}
          aria-label={`${row.label}: ${String(row.hit)} of ${String(row.base)}${refSpoken(row, events)}`}
          title={refTitle(row, events)}
          data-filtered={events.filtered ? "" : undefined}
          style={
            {
              "--share": String(row.base === 0 ? 0 : Math.min(1, row.hit / row.base)),
            } as CSSProperties
          }
          {...peekProps(row.id, events)}
        >
          {row.label} <span>{row.base}</span>
          {row.ghost !== 0 && <Ghost delta={row.ghost} />}
          {row.ghost === 0 && row.baseGhost !== 0 && events.baseline && (
            <Ghost delta={row.baseGhost} faint />
          )}
          <RefNote row={row} />
        </button>
      ))}
    </div>
  );
}

const STACK_GAP = 4;
const STACK_REACH = 6;

function stackOffsets<T>(items: readonly T[], key: (item: T) => number): number[] {
  const seen = new Map<number, number>();
  const totals = new Map<number, number>();
  for (const item of items) {
    totals.set(key(item), (totals.get(key(item)) ?? 0) + 1);
  }
  return items.map((item) => {
    const index = seen.get(key(item)) ?? 0;
    seen.set(key(item), index + 1);
    const total = totals.get(key(item)) ?? 1;
    const gap = total < 2 ? 0 : Math.min(STACK_GAP, (2 * STACK_REACH) / (total - 1));
    return (index - (total - 1) / 2) * gap;
  });
}

export function BalanceStrips({
  rows,
  events,
}: {
  rows: readonly BalanceRow[];
  events: ChartEvents;
}): ReactNode {
  if (rows.length === 0) {
    return <p className="lab-empty">No creatures in this scope</p>;
  }
  const top = Math.max(
    1,
    ...rows.flatMap((row) => [
      row.range?.max ?? 0,
      row.refRange?.median ?? 0,
      ...row.dots.map((dot) => dot.size),
    ]),
  );
  const pct = (value: number): string => `${String((value / top) * 100)}%`;
  return (
    <div className="lab-balance" role="list" aria-label="Creature balance">
      {rows.map((row) => {
        const shownDots = row.dots.filter((dot) => dot.state !== "faint" || events.baseline);
        const offsets = stackOffsets(shownDots, (dot) => dot.size);
        return (
          <button
            key={row.tally.id}
            type="button"
            role="listitem"
            className="lab-balance-row"
            data-ghost={row.tally.ghost === 0 ? undefined : row.tally.ghost > 0 ? "up" : "down"}
            aria-label={`MV ${row.tally.label}: ${String(row.tally.hit)} of ${String(row.tally.base)} creatures${refSpoken(row.tally, events)}`}
            title={refTitle(row.tally, events)}
            {...peekProps(row.tally.id, events)}
          >
            <span className="lab-balance-mv">{row.tally.label}</span>
            <span className="lab-balance-track">
              {row.range && (
                <>
                  <span
                    className="lab-balance-range"
                    style={{ left: pct(row.range.min), width: pct(row.range.max - row.range.min) }}
                  />
                  <span
                    className="lab-balance-band"
                    style={{ left: pct(row.range.q1), width: pct(row.range.q3 - row.range.q1) }}
                  />
                  <span className="lab-balance-median" style={{ left: pct(row.range.median) }} />
                </>
              )}
              {row.refRange && (
                <span
                  className="lab-ref-tick"
                  data-axis="x"
                  title={`${events.against ?? "Other cube"} median: ${String(row.refRange.median)}`}
                  style={{ left: pct(row.refRange.median) }}
                />
              )}
              {shownDots.map((dot, index) => (
                <i
                  key={dot.card.slug}
                  data-state={dot.state}
                  data-place={dot.place}
                  title={`${dot.card.name} ${String(dot.power)}/${String(dot.toughness)}`}
                  style={
                    {
                      left: pct(dot.size),
                      "--stack": String(offsets[index] ?? 0),
                    } as CSSProperties
                  }
                />
              ))}
            </span>
            <span className="lab-balance-value">
              {events.filtered && events.baseline
                ? `${String(row.tally.hit)}/${String(row.tally.base)}`
                : row.tally.hit}
              {row.tally.ghost !== 0 && <Ghost delta={row.tally.ghost} />}
              {row.tally.ghost === 0 && row.tally.baseGhost !== 0 && events.baseline && (
                <Ghost delta={row.tally.baseGhost} faint />
              )}
              <RefNote row={row.tally} />
            </span>
          </button>
        );
      })}
      <div className="lab-balance-foot" aria-hidden="true">
        <span>MV</span>
        <span className="lab-balance-scale">
          <span>0</span>
          <span>power + toughness</span>
          <span>{top}</span>
        </span>
        <span />
      </div>
    </div>
  );
}

function dotRadius(count: number): number {
  return 3 + Math.sqrt(count) * 2.2;
}

export function CombatPlot({ data, events }: { data: Matchups; events: ChartEvents }): ReactNode {
  if (data.dots.length === 0) {
    return <p className="lab-empty">No creatures in this scope</p>;
  }
  return (
    <div className="lab-combat" aria-label="Combat matchups">
      {data.corners.map((corner) => (
        <span
          key={corner.id}
          className="lab-combat-corner"
          data-corner={corner.corner}
          title={refTitle(corner, events)}
          style={{ gridArea: corner.corner }}
        >
          <span className="lab-combat-title">
            {MATCHUP_CORNERS.find((entry) => entry.id === corner.corner)?.title}
          </span>
          <span className="lab-combat-count">
            {events.filtered && events.baseline
              ? `${String(corner.hit)}/${String(corner.base)}`
              : corner.hit}
            {corner.ghost !== 0 && <Ghost delta={corner.ghost} />}
            {corner.ghost === 0 && corner.baseGhost !== 0 && events.baseline && (
              <Ghost delta={corner.baseGhost} faint />
            )}
            <RefNote row={corner} />
          </span>
        </span>
      ))}
      <div className="lab-combat-field">
        <div className="lab-combat-tints" aria-hidden="true">
          {MATCHUP_CORNERS.map((corner) => (
            <i key={corner.id} data-corner={corner.id} style={{ gridArea: corner.id }} />
          ))}
        </div>
        <div className="lab-combat-plot" role="list" aria-label="Bodies">
          {data.dots.map((dot) => {
            const { tally: row } = dot;
            const faint = events.filtered && row.hit === 0 && row.ghost === 0;
            if (faint && !events.baseline) {
              return null;
            }
            const state = dot.arriving
              ? "arriving"
              : dot.leaving
                ? "leaving"
                : faint
                  ? "faint"
                  : "hit";
            const count = Math.max(row.base, row.base + row.baseGhost, 1);
            return (
              <button
                key={row.id}
                type="button"
                role="listitem"
                className="lab-combat-dot"
                data-state={state}
                data-ghost={row.ghost === 0 ? undefined : row.ghost > 0 ? "up" : "down"}
                aria-label={`${row.label}: ${String(row.hit)} of ${String(row.base)}`}
                title={`${row.label} · kills ${String(Math.round(dot.kills * 100))}%, survives ${String(Math.round(dot.survives * 100))}%\n${dot.names.join(", ")}`}
                style={
                  {
                    left: `${String(dot.kills * 100)}%`,
                    bottom: `${String(dot.survives * 100)}%`,
                    "--r": `${String(dotRadius(count))}px`,
                  } as CSSProperties
                }
                {...peekProps(row.id, events)}
              >
                {row.ghost !== 0 && <Ghost delta={row.ghost} />}
              </button>
            );
          })}
        </div>
      </div>
      <span className="lab-combat-axis" data-axis="x" aria-hidden="true">
        kills →
      </span>
      <span className="lab-combat-axis" data-axis="y" aria-hidden="true">
        survives →
      </span>
    </div>
  );
}
