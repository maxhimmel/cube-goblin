import { mode } from "#mode";
import type { Count, TagKind } from "@repo/cube/browser";
import { COLOR_GROUPS, CURVE_COLUMNS, TAG_KINDS, cubeStats } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useState } from "react";
import { Gauge } from "../gauge.tsx";
import { ManaSymbol } from "../mana.tsx";
import type { GridCard } from "../modes/mode.ts";
import type { BarFill, TickLabel } from "./charts.tsx";
import { ChartCard, ColumnChart, CountTable, HeatChart, RowChart } from "./charts.tsx";

interface Scope {
  id: string;
  label: string;
  includes: (card: GridCard, selection: ReadonlySet<string>) => boolean;
}

const SCOPES: readonly Scope[] = [
  { id: "draft", label: "Draft", includes: (card) => card.status === "draft" },
  { id: "considered", label: "Draft + prospects", includes: (card) => card.status !== "cut" },
  { id: "all", label: "All cards", includes: () => true },
  { id: "selected", label: "Selected", includes: (card, selection) => selection.has(card.slug) },
];

const KIND_TITLES: Record<TagKind, string> = { archetype: "Archetypes", group: "Groups" };

const COLOR_SYMBOLS: Record<string, string> = { multicolored: "multicolor", colorless: "C" };

function colorIcon(id: string): ReactNode {
  const symbol = COLOR_SYMBOLS[id] ?? id;
  return symbol === "multicolor" ? (
    <i className="ms ms-multicolor" aria-hidden="true" />
  ) : (
    <i className={`ms ms-${symbol.toLowerCase()} ms-cost`} aria-hidden="true" />
  );
}

const MANA_FILLS: Record<string, string> = {
  W: "var(--mana-w)",
  U: "var(--mana-u)",
  B: "var(--mana-b)",
  R: "var(--mana-r)",
  G: "var(--mana-g)",
  multicolored: "var(--mana-m)",
  colorless: "var(--mana-c)",
};

function manaFill(row: Count): string {
  return MANA_FILLS[row.id] ?? "var(--chart-bar)";
}

const colorTick: TickLabel = (id) => (
  <>
    {colorIcon(id)} {COLOR_GROUPS.find((group) => group.id === id)?.label ?? id}
  </>
);

const curveTick: TickLabel = (id) => {
  const label = CURVE_COLUMNS.find((column) => column.id === id)?.label ?? id;
  return (
    <>
      <ManaSymbol symbol={id} label={label} />
      {label.endsWith("+") && <span aria-hidden="true">+</span>}
    </>
  );
};

function Tile({ label, value, note }: { label: string; value: number; note?: string }): ReactNode {
  return (
    <div className="stat-tile" data-testid={`stat-${label.toLowerCase()}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {note !== undefined && <span className="muted stat-note">{note}</span>}
    </div>
  );
}

function percent(part: number, whole: number): string {
  return whole === 0 ? "–" : `${String(Math.round((part / whole) * 100))}%`;
}

function asOf(iso: string | undefined): string {
  return iso === undefined ? "not downloaded yet" : `as of ${iso.slice(0, 10)}`;
}

function Bars({
  title,
  rows,
  unit = "cards",
  caption,
  tick,
  fill,
}: {
  title: string;
  rows: readonly Count[];
  unit?: string;
  caption?: ReactNode;
  tick?: TickLabel;
  fill: BarFill;
}): ReactNode {
  return (
    <ChartCard
      title={title}
      caption={caption}
      table={<CountTable caption={title} rows={rows} {...(tick ? { head: tick } : {})} />}
    >
      <RowChart rows={rows} name={title} unit={unit} fill={fill} {...(tick ? { tick } : {})} />
    </ChartCard>
  );
}

export function InsightsPage(): ReactNode {
  const cube = mode.useCube();
  const selection = mode.useSelection();
  const [scopeId, setScopeId] = useState("draft");
  if (!cube) {
    return <p className="muted">Loading cube…</p>;
  }
  const scopes = SCOPES.filter((option) => option.id !== "selected" || mode.name === "workbench");
  const scope = scopes.find((option) => option.id === scopeId) ?? scopes[0];
  const cards = scope ? cube.cards.filter((card) => scope.includes(card, selection)) : [];
  const stats = cubeStats(cards, cube.vocabulary, cube.sections);
  const drafted = cube.cards.filter((card) => card.status === "draft").length;
  const nonland = stats.total - stats.lands;

  return (
    <div className="insights">
      <div className="insights-filters">
        <h1>Insights</h1>
        <label>
          Count cards in{" "}
          <select
            aria-label="Count cards in"
            value={scope?.id}
            onChange={(event) => {
              setScopeId(event.target.value);
            }}
          >
            {scopes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id === "selected"
                  ? `${option.label} (${String(selection.size)})`
                  : option.label}
              </option>
            ))}
          </select>
        </label>
        {cube.size && <Gauge count={drafted} size={cube.size} />}
      </div>

      <div className="stat-tiles" data-testid="stat-tiles">
        <Tile label="Cards" value={stats.total} />
        <Tile label="Nonland" value={nonland} />
        <Tile label="Lands" value={stats.lands} note={percent(stats.lands, stats.total)} />
        <Tile
          label="Creatures"
          value={stats.creatures}
          note={`${percent(stats.creatures, nonland)} of nonland`}
        />
      </div>

      {stats.total === 0 ? (
        <p className="muted">No cards in this scope.</p>
      ) : (
        <div className="chart-grid">
          <ChartCard
            title="Mana curve"
            caption="Nonland cards by mana value"
            table={<CountTable caption="Mana curve" rows={stats.curve} head={curveTick} />}
          >
            <ColumnChart
              rows={stats.curve}
              name="Mana curve"
              unit="cards"
              category="Mana value"
              fill="var(--chart-curve)"
              tick={curveTick}
            />
          </ChartCard>
          <Bars
            title="Color"
            caption="Nonland cards by color"
            rows={stats.colors}
            tick={colorTick}
            fill={manaFill}
          />
          <ChartCard
            wide
            title="Color by mana value"
            caption="Nonland cards by color and mana value; stronger color means more"
            table={
              <CountTable
                caption="Color by mana value"
                rows={stats.colorCurve.map((entry) => ({
                  id: `${entry.row}-${entry.column}`,
                  label: `${COLOR_GROUPS.find((group) => group.id === entry.row)?.label ?? entry.row}, ${CURVE_COLUMNS.find((column) => column.id === entry.column)?.label ?? entry.column}`,
                  count: entry.count,
                }))}
              />
            }
          >
            <HeatChart
              cells={stats.colorCurve}
              rows={COLOR_GROUPS}
              columns={CURVE_COLUMNS}
              name="Color by mana value"
              rowTick={colorTick}
              columnTick={curveTick}
            />
          </ChartCard>
          <Bars
            title="Mana symbols"
            caption="Colored symbols in mana costs; hybrid counts for both colors"
            rows={stats.pips}
            unit="symbols"
            tick={colorTick}
            fill={manaFill}
          />
          <Bars title="Card types" rows={stats.types} fill="var(--chart-types)" />
          <Bars
            title="Functions"
            caption={`Scryfall oracle tags, ${asOf(cube.functionsAsOf)}. Fixing also counts cards that make two or more colors of mana.`}
            rows={stats.functions}
            fill="var(--chart-functions)"
          />
          {scope?.id !== "draft" && (
            <Bars title="Status" rows={stats.status} fill="var(--chart-status)" />
          )}
          {stats.sections.length > 0 && (
            <Bars title="Sections" rows={stats.sections} fill="var(--chart-sections)" />
          )}
          {TAG_KINDS.map((kind) => {
            const rows = stats.tags.filter((row) => row.kind === kind);
            return rows.length > 0 ? (
              <Bars
                key={kind}
                title={KIND_TITLES[kind]}
                rows={rows}
                fill={`var(--chart-${kind})`}
              />
            ) : (
              <ChartCard key={kind} title={KIND_TITLES[kind]}>
                <p className="muted">No {kind} tags yet.</p>
              </ChartCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
