import { mode } from "#mode";
import type { Bucket, BucketKind, Count, CubeStats } from "@repo/cube/browser";
import {
  COLORS,
  COLOR_GROUPS,
  CURVE_COLUMNS,
  HEAVY_PIPS,
  bucketId,
  cubeStats,
  parseBucket,
} from "@repo/cube/browser";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Responsive, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import type { ReactNode } from "react";
import { Gauge } from "../gauge.tsx";
import { ManaSymbol } from "../mana.tsx";
import type { GridCard } from "../modes/mode.ts";
import { Block } from "./block.tsx";
import { BucketPanel } from "./bucket-panel.tsx";
import type { BarFill, StackedRow, TickLabel } from "./charts.tsx";
import { ColumnChart, CountTable, HeatChart, RowChart, StackedRowChart } from "./charts.tsx";
import type { BlockId, Dashboard } from "./layout.ts";
import { BLOCKS, BREAKPOINTS, COLS, ROW_HEIGHT, shown, useDashboard } from "./layout.ts";

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

const COLOR_SYMBOLS: Record<string, string> = { multicolored: "multicolor", colorless: "C" };

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

function colorIcon(id: string): ReactNode {
  const symbol = COLOR_SYMBOLS[id] ?? id;
  return symbol === "multicolor" ? (
    <i className="ms ms-multicolor" aria-hidden="true" />
  ) : (
    <i className={`ms ms-${symbol.toLowerCase()} ms-cost`} aria-hidden="true" />
  );
}

function colorLabel(id: string): string {
  return COLOR_GROUPS.find((group) => group.id === id)?.label ?? id;
}

function curveLabel(id: string): string {
  return CURVE_COLUMNS.find((column) => column.id === id)?.label ?? id;
}

const colorTick: TickLabel = (id) => (
  <>
    {colorIcon(id)} {colorLabel(id)}
  </>
);

const curveTick: TickLabel = (id) => {
  const label = curveLabel(id);
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

const RARE_TYPES: ReadonlySet<string> = new Set(["battle", "other"]);

interface BarBlock {
  kind: BucketKind;
  title: string;
  rows: (stats: CubeStats) => Count[];
  fill: BarFill;
  caption?: (asOfText: string) => string;
  tick?: TickLabel;
  empty?: string;
}

const BAR_BLOCKS: Partial<Record<BlockId, BarBlock>> = {
  heavy: {
    kind: "heavy",
    title: "Heavy pips",
    rows: (stats) => stats.heavy,
    fill: manaFill,
    caption: () =>
      `Nonland cards with ${String(HEAVY_PIPS)} or more pips of one color, like {R}{R}; hybrid counts for both colors`,
    tick: colorTick,
  },
  types: {
    kind: "type",
    title: "Card types",
    rows: (stats) => stats.types.filter((row) => row.count > 0 || !RARE_TYPES.has(row.id)),
    fill: "var(--chart-types)",
    caption: () => "A card counts under every type on its front face",
  },
  functions: {
    kind: "function",
    title: "Functions",
    rows: (stats) => stats.functions,
    fill: "var(--chart-functions)",
    caption: (when) =>
      `Scryfall oracle tags, ${when}. Fixing also counts cards that make two or more colors of mana.`,
  },
  status: {
    kind: "status",
    title: "Status",
    rows: (stats) => stats.status,
    fill: "var(--chart-status)",
  },
  archetype: {
    kind: "tag",
    title: "Archetypes",
    rows: (stats) => stats.tags.filter((row) => row.kind === "archetype"),
    fill: "var(--chart-archetype)",
    empty: "No archetype tags yet.",
  },
  group: {
    kind: "tag",
    title: "Groups",
    rows: (stats) => stats.tags.filter((row) => row.kind === "group"),
    fill: "var(--chart-group)",
    empty: "No group tags yet.",
  },
};

const KIND_TITLES: Record<BucketKind, string> = {
  curve: "Mana curve",
  color: "Color",
  colorCurve: "Color by mana value",
  presence: "Color",
  colorMulti: "Color",
  heavy: "Heavy pips",
  type: "Card types",
  function: "Functions",
  status: "Status",
  tag: "Tags",
};

function bucketLabel(bucket: Bucket, stats: CubeStats): string {
  const [first = "", second = ""] = bucket.keys;
  const find = (rows: readonly Count[]): string =>
    rows.find((row) => row.id === first)?.label ?? first;
  switch (bucket.kind) {
    case "curve":
      return `Mana value ${curveLabel(first)}`;
    case "color":
    case "presence":
      return colorLabel(first);
    case "colorMulti":
      return `Multicolored with ${colorLabel(first)}`;
    case "heavy":
      return `${colorLabel(first)}, ${String(HEAVY_PIPS)}+ pips`;
    case "colorCurve":
      return `${colorLabel(first)}, mana value ${curveLabel(second)}`;
    case "type":
      return find(stats.types);
    case "function":
      return find(stats.functions);
    case "status":
      return find(stats.status);
    case "tag":
      return find(stats.tags);
  }
}

const DARK_INK: ReadonlySet<string> = new Set(["W", "multicolored", "colorless"]);

function colorRows(stats: CubeStats): StackedRow[] {
  const mono = new Map(stats.colors.map((row) => [row.id, row.count]));
  const presence = new Map(stats.presence.map((row) => [row.id, row.count]));
  return COLOR_GROUPS.map((group) => {
    const own = mono.get(group.id) ?? 0;
    const fill = MANA_FILLS[group.id] ?? "var(--chart-bar)";
    const solo = {
      bucket: bucketId("color", group.id),
      label: group.label,
      count: own,
      fill,
      ink: DARK_INK.has(group.id) ? "#1b2230" : "#fff",
    };
    if (!COLORS.some((color) => color.id === group.id)) {
      return { id: group.id, label: group.label, bucket: solo.bucket, parts: [solo] };
    }
    return {
      id: group.id,
      label: group.label,
      bucket: bucketId("presence", group.id),
      parts: [
        { ...solo, label: `Mono ${group.label.toLowerCase()}` },
        {
          bucket: bucketId("colorMulti", group.id),
          label: `Multicolored with ${group.label.toLowerCase()}`,
          count: (presence.get(group.id) ?? 0) - own,
          fill: `color-mix(in oklab, ${fill} 45%, var(--panel))`,
          ink: "var(--fg)",
        },
      ],
    };
  });
}

function colorTable(rows: readonly StackedRow[]): Count[] {
  return rows.flatMap((row) => {
    const parts = row.parts.map((part) => ({
      id: part.bucket,
      label: part.label,
      count: part.count,
    }));
    if (row.parts.length < 2) {
      return parts;
    }
    const total = row.parts.reduce((sum, part) => sum + part.count, 0);
    return [...parts, { id: row.bucket, label: `All ${row.label.toLowerCase()}`, count: total }];
  });
}

function selectedIn(bucket: Bucket | undefined, kind: BucketKind): string | undefined {
  return bucket?.kind === kind ? bucket.keys[0] : undefined;
}

function DashboardGrid({
  dashboard,
  render,
}: {
  dashboard: Dashboard;
  render: (id: BlockId) => ReactNode;
}): ReactNode {
  const { width, containerRef, mounted } = useContainerWidth();
  return (
    <div ref={containerRef} className="insights-grid">
      {mounted && (
        <Responsive
          width={width}
          layouts={shown(dashboard)}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          dragConfig={{ handle: ".block-head", cancel: "button, select, a, input" }}
          onLayoutChange={(_, all) => {
            dashboard.change(all);
          }}
        >
          {BLOCKS.map((block) => (
            <div key={block.id} className="block-cell" data-block={block.id}>
              {render(block.id)}
            </div>
          ))}
        </Responsive>
      )}
    </div>
  );
}

export function InsightsPage(): ReactNode {
  const cube = mode.useCube();
  const selection = mode.useSelection();
  const search = useSearch({ from: "/insights" });
  const navigate = useNavigate();
  const dashboard = useDashboard();
  if (!cube) {
    return <p className="muted">Loading cube…</p>;
  }
  const scopes = SCOPES.filter((option) => option.id !== "selected" || mode.name === "workbench");
  const scope = scopes.find((option) => option.id === search.scope) ?? scopes[0];
  const cards = scope ? cube.cards.filter((card) => scope.includes(card, selection)) : [];
  const stats = cubeStats(cards, cube.vocabulary);
  const drafted = cube.cards.filter((card) => card.status === "draft").length;
  const nonland = stats.total - stats.lands;
  const bucket = search.bucket === undefined ? undefined : parseBucket(search.bucket);
  const when = asOf(cube.functionsAsOf);

  const pick = (id: string): void => {
    void navigate({
      to: "/insights",
      search: (prev) => ({ ...prev, bucket: prev.bucket === id ? undefined : id }),
      resetScroll: false,
    });
  };
  const closeBucket = (): void => {
    void navigate({
      to: "/insights",
      search: (prev) => ({ ...prev, bucket: undefined }),
      resetScroll: false,
    });
  };

  const content = (id: BlockId): ReactNode => {
    const collapsed = dashboard.collapsed.has(id);
    const toggle = (): void => {
      dashboard.toggle(id);
    };
    if (id === "summary") {
      return (
        <Block title="Summary" collapsed={collapsed} onToggle={toggle}>
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
        </Block>
      );
    }
    if (id === "curve") {
      const selected = selectedIn(bucket, "curve");
      const onPick = (key: string): void => {
        pick(bucketId("curve", key));
      };
      return (
        <Block
          title="Mana curve"
          caption="Nonland cards by mana value"
          collapsed={collapsed}
          onToggle={toggle}
          table={
            <CountTable
              caption="Mana curve"
              rows={stats.curve}
              head={curveTick}
              selected={selected}
              onPick={onPick}
            />
          }
        >
          <ColumnChart
            rows={stats.curve}
            name="Mana curve"
            fill="var(--chart-curve)"
            tick={curveTick}
            selected={selected}
            onPick={onPick}
          />
        </Block>
      );
    }
    if (id === "color") {
      const rows = colorRows(stats);
      return (
        <Block
          title="Color"
          caption="Nonland cards by color. The pale part of a bar is multicolored cards with that color. Click a part for those cards, or a color's name for all of them."
          collapsed={collapsed}
          onToggle={toggle}
          table={
            <CountTable
              caption="Color"
              rows={colorTable(rows)}
              selected={search.bucket}
              onPick={pick}
            />
          }
        >
          <StackedRowChart
            rows={rows}
            name="Color"
            tick={colorTick}
            selected={search.bucket}
            onPick={pick}
          />
        </Block>
      );
    }
    if (id === "heat") {
      const selected =
        bucket?.kind === "colorCurve"
          ? { row: bucket.keys[0] ?? "", column: bucket.keys[1] ?? "" }
          : undefined;
      return (
        <Block
          title="Color by mana value"
          caption="Nonland cards by color and mana value; stronger color means more"
          collapsed={collapsed}
          onToggle={toggle}
          table={
            <CountTable
              caption="Color by mana value"
              rows={stats.colorCurve.map((entry) => ({
                id: bucketId("colorCurve", entry.row, entry.column),
                label: `${colorLabel(entry.row)}, ${curveLabel(entry.column)}`,
                count: entry.count,
              }))}
              selected={search.bucket}
              onPick={pick}
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
            selected={selected}
            onPick={(row, column) => {
              pick(bucketId("colorCurve", row, column));
            }}
          />
        </Block>
      );
    }
    const spec = BAR_BLOCKS[id];
    if (!spec) {
      return null;
    }
    const rows = spec.rows(stats);
    const selected = selectedIn(bucket, spec.kind);
    const onPick = (key: string): void => {
      pick(bucketId(spec.kind, key));
    };
    return (
      <Block
        title={spec.title}
        caption={spec.caption?.(when)}
        collapsed={collapsed}
        onToggle={toggle}
        {...(rows.length > 0
          ? {
              table: (
                <CountTable
                  caption={spec.title}
                  rows={rows}
                  head={spec.tick}
                  selected={selected}
                  onPick={onPick}
                />
              ),
            }
          : {})}
      >
        {rows.length === 0 ? (
          <p className="muted">{spec.empty}</p>
        ) : (
          <RowChart
            rows={rows}
            name={spec.title}
            fill={spec.fill}
            tick={spec.tick}
            selected={selected}
            onPick={onPick}
          />
        )}
      </Block>
    );
  };

  return (
    <div className="insights" data-panel={bucket !== undefined}>
      <div className="insights-filters">
        <h1>Insights</h1>
        <label>
          Count cards in{" "}
          <select
            aria-label="Count cards in"
            value={scope?.id}
            onChange={(event) => {
              const next = event.target.value;
              void navigate({
                to: "/insights",
                search: (prev) => ({ ...prev, scope: next === "draft" ? undefined : next }),
              });
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
        <button type="button" className="toolbar-link" onClick={dashboard.reset}>
          Reset layout
        </button>
      </div>
      <div className="insights-body">
        <DashboardGrid dashboard={dashboard} render={content} />
        {bucket && (
          <BucketPanel
            bucket={bucket}
            title={KIND_TITLES[bucket.kind]}
            label={bucketLabel(bucket, stats)}
            cards={cards}
            onClose={closeBucket}
          />
        )}
      </div>
    </div>
  );
}
