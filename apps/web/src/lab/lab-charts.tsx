import { colorKey } from "@repo/cube/browser";
import type { CSSProperties, ReactNode } from "react";
import { colorLabel, ptLabel } from "../insights/labels.tsx";
import type { GridCard } from "../modes/mode.ts";
import type { HeatRow, Tally, Test, Used } from "./model.ts";
import { PT_AXIS, ghostLabel, isCreatureCard, ptCell } from "./model.ts";

export interface ChartEvents {
  onPeek: (key: string | undefined) => void;
  onPick: (key: string) => void;
  baseline: boolean;
  filtered: boolean;
  picked: ReadonlySet<string>;
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

function curveId(tally: Tally): string {
  return tally.id.split(":").at(-1) ?? "";
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
  const scaleToBase = events.baseline || !events.filtered;
  const top = Math.max(
    1,
    ...rows.map((row) => Math.max(scaleToBase ? row.base + row.baseGhost : 0, row.hit + row.ghost)),
  );
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
          aria-label={`MV ${row.label}: ${String(row.hit)} of ${String(row.base)}`}
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
            return (
              <button
                key={cell.id}
                type="button"
                className="lab-heat-cell"
                data-empty={cell.base === 0 && cell.baseGhost === 0 ? "" : undefined}
                data-ghost={cell.ghost === 0 ? undefined : cell.ghost > 0 ? "up" : "down"}
                data-base-ghost={
                  cell.ghost === 0 && cell.baseGhost !== 0 && events.baseline ? "" : undefined
                }
                aria-label={`${row.label}, MV ${cell.label}: ${String(cell.hit)}`}
                style={
                  {
                    "--heat": String(cell.base / top),
                    "--share": String(events.filtered ? share : 1),
                    "--swatch": MANA_VAR[row.id],
                  } as CSSProperties
                }
                {...peekProps(cell.id, events)}
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
            return (
              <button
                key={tough}
                type="button"
                className="lab-pt-cell"
                aria-label={`${ptLabel(power)}/${ptLabel(tough)}: ${String(here.length)}`}
                data-empty={here.length === 0 ? "" : undefined}
                {...peekProps(key, events)}
              >
                {here.map((card) => {
                  const state =
                    now.has(card.slug) && !later.has(card.slug)
                      ? "leaving"
                      : !now.has(card.slug)
                        ? "arriving"
                        : lens && !lens(card)
                          ? "faint"
                          : "hit";
                  if (state === "faint" && !events.baseline) {
                    return null;
                  }
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

function scaleTop(rows: readonly Tally[], events: ChartEvents): number {
  const toBase = events.baseline || !events.filtered;
  return Math.max(
    1,
    ...rows.map((row) => Math.max(toBase ? row.base + row.baseGhost : 0, row.hit + row.ghost)),
  );
}

function shown(row: Tally): boolean {
  return row.base > 0 || row.baseGhost !== 0 || row.hit > 0 || row.ghost !== 0;
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
  const top = scaleTop(rows, events);
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
          aria-label={`${row.label}: ${String(row.hit)} of ${String(row.base)}`}
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
          </span>
          <span className="lab-hbar-value">
            {events.filtered && events.baseline
              ? `${String(row.hit)}/${String(row.base)}`
              : row.hit}
            {row.ghost !== 0 && <Ghost delta={row.ghost} />}
            {row.ghost === 0 && row.baseGhost !== 0 && events.baseline && (
              <Ghost delta={row.baseGhost} faint />
            )}
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
          </>
        );
        return pickable ? (
          <button
            key={row.id}
            type="button"
            role="listitem"
            className="lab-stat"
            aria-label={`${row.label}: ${String(row.hit)}`}
            {...peekProps(row.id, events)}
          >
            {body}
          </button>
        ) : (
          <div key={row.id} role="listitem" className="lab-stat">
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
    <div className="lab-chips" role="list" aria-label={name}>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          role="listitem"
          className="lab-chip"
          data-ghost={row.ghost === 0 ? undefined : row.ghost > 0 ? "up" : "down"}
          aria-label={`${row.label}: ${String(row.hit)} of ${String(row.base)}`}
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
        </button>
      ))}
    </div>
  );
}
