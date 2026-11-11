import { colorKey } from "@repo/cube/browser";
import type { CSSProperties, ReactNode } from "react";
import type { GridCard } from "../modes/mode.ts";
import type { HeatRow, Tally, Test } from "./model.ts";
import { PT_AXIS, ghostLabel, isCreatureCard, ptCell } from "./model.ts";

export interface ChartEvents {
  onPeek: (key: string | undefined) => void;
  onPick: (key: string) => void;
  baseline: boolean;
  filtered: boolean;
}

const MANA_VAR: Record<string, string> = {
  W: "var(--mana-w)",
  U: "var(--mana-u)",
  B: "var(--mana-b)",
  R: "var(--mana-r)",
  G: "var(--mana-g)",
  M: "var(--mana-m)",
  C: "var(--mana-c)",
};

function peekProps(key: string, events: ChartEvents) {
  return {
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

export function CurveBars({
  tallies,
  events,
}: {
  tallies: readonly Tally[];
  events: ChartEvents;
}): ReactNode {
  const top = Math.max(
    1,
    ...tallies.map((row) => Math.max(row.base + row.baseGhost, row.hit + row.ghost)),
  );
  const pct = (value: number): string => `${String((value / top) * 100)}%`;
  return (
    <div className="lab-bars" role="list" aria-label="Mana curve">
      {tallies.map((row) => (
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
            {row.ghost !== 0 && <em>{ghostLabel(row.ghost)}</em>}
            {row.ghost === 0 && row.baseGhost !== 0 && events.baseline && (
              <em data-faint="">{ghostLabel(row.baseGhost)}</em>
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

const COLOR_ID: Record<string, string> = {
  multicolored: "M",
  colorless: "C",
};

export function Heat({
  rows,
  events,
}: {
  rows: readonly HeatRow[];
  events: ChartEvents;
}): ReactNode {
  const top = Math.max(1, ...rows.flatMap((row) => row.cells.map((cell) => cell.base)));
  const heads = rows[0]?.cells ?? [];
  return (
    <div
      className="lab-heat"
      style={{ "--heat-columns": heads.length } as CSSProperties}
      role="table"
      aria-label="Color by mana value"
    >
      <span />
      {heads.map((cell) => (
        <span key={cell.label} className="lab-heat-head">
          {cell.label}
        </span>
      ))}
      {rows.map((row) => (
        <div key={row.id} className="lab-heat-row" role="row">
          <span
            className="lab-heat-color"
            style={{ "--swatch": MANA_VAR[COLOR_ID[row.id] ?? row.id] } as CSSProperties}
            title={row.label}
          />
          {row.cells.map((cell) => {
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
                    "--swatch": MANA_VAR[COLOR_ID[row.id] ?? row.id],
                  } as CSSProperties
                }
                {...peekProps(cell.id, events)}
              >
                {events.baseline && events.filtered && cell.base > 0 && (
                  <span className="lab-heat-base" />
                )}
                <span className="lab-heat-fill" />
                <span className="lab-heat-count">
                  {shown > 0 ? shown : ""}
                  {cell.ghost !== 0 && <em>{ghostLabel(cell.ghost)}</em>}
                  {cell.ghost === 0 && cell.baseGhost !== 0 && events.baseline && (
                    <em data-faint="">{ghostLabel(cell.baseGhost)}</em>
                  )}
                </span>
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
}: {
  scope: readonly GridCard[];
  next: readonly GridCard[];
  lens: Test | undefined;
  events: ChartEvents;
}): ReactNode {
  const now = new Set(scope.map((card) => card.slug));
  const later = new Set(next.map((card) => card.slug));
  const creatures = [...new Map([...scope, ...next].map((card) => [card.slug, card])).values()]
    .filter(isCreatureCard)
    .toSorted((a, b) => colorKey(a).localeCompare(colorKey(b)));
  const powers = PT_AXIS.toReversed();
  return (
    <div
      className="lab-pt"
      style={{ "--pt-columns": PT_AXIS.length } as CSSProperties}
      aria-label="Creature power by toughness"
    >
      {powers.map((power) => (
        <div key={power} className="lab-pt-row">
          <span className="lab-pt-axis">{power}</span>
          {PT_AXIS.map((toughness) => {
            const here = creatures.filter(
              (card) => ptCell(card.power) === power && ptCell(card.toughness) === toughness,
            );
            const key = `pt:${power}:${toughness}`;
            return (
              <button
                key={toughness}
                type="button"
                className="lab-pt-cell"
                aria-label={`${power}/${toughness}: ${String(here.length)}`}
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
        <span className="lab-pt-axis">P↑ T→</span>
        {PT_AXIS.map((toughness) => (
          <span key={toughness} className="lab-pt-axis">
            {toughness}
          </span>
        ))}
      </div>
    </div>
  );
}
