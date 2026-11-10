import { mode } from "#mode";
import type { Body, Bucket, BucketKind, Count, CubeStats, Spread } from "@repo/cube/browser";
import {
  COLORS,
  COLOR_GROUPS,
  CURVE_COLUMNS,
  HEAVY_PIPS,
  combatMatchups,
  creatureBalance,
  curveKey,
  isOutlier,
  size,
  PT_VALUES,
  bucketId,
  cubeStats,
  parseBucket,
} from "@repo/cube/browser";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Responsive, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import type { ReactNode } from "react";
import { CardLink } from "../card-pane.tsx";
import { Gauge } from "../gauge.tsx";
import { ManaSymbol } from "../mana.tsx";
import type { GridCard } from "../modes/mode.ts";
import { Block } from "./block.tsx";
import { BucketPanel } from "./bucket-panel.tsx";
import type { BarFill, StackedRow, TickLabel } from "./charts.tsx";
import {
  ColumnChart,
  CountTable,
  CreatureChart,
  HeatChart,
  MatchupChart,
  RowChart,
  StackedRowChart,
} from "./charts.tsx";
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

function ptLabel(id: string): string {
  return PT_VALUES.find((value) => value.id === id)?.label ?? id;
}

const ptTick: TickLabel = (id) => ptLabel(id);

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

function decimal(value: number | undefined): string {
  return value === undefined ? "–" : value.toFixed(1);
}

function BodyLink({ entry }: { entry: Body<GridCard> | undefined }): ReactNode {
  if (!entry) {
    return <span className="muted">–</span>;
  }
  return (
    <CardLink slug={entry.card.slug} className="body-link">
      {entry.card.name}{" "}
      <span className="body-pt">
        {entry.power}/{entry.toughness}
      </span>
    </CardLink>
  );
}

const NAMES_SHOWN = 4;

function matchupPoints(cards: readonly GridCard[]) {
  return combatMatchups(creatureBalance(cards).bodies).map((matchup) => {
    const names = matchup.bodies.map((entry) => entry.card.name);
    const shown = names.slice(0, NAMES_SHOWN).join(", ");
    return {
      id: bucketId("body", String(matchup.power), String(matchup.toughness)),
      body: `${String(matchup.power)}/${String(matchup.toughness)}`,
      count: names.length,
      names:
        names.length > NAMES_SHOWN
          ? `${shown}, +${String(names.length - NAMES_SHOWN)} more`
          : shown,
      kills: matchup.kills * 100,
      survives: matchup.survives * 100,
    };
  });
}

const LEGEND = [
  {
    shape: "dot",
    color: "var(--chart-above)",
    label: "big for its mana value (above the middle half)",
  },
  { shape: "dot", color: "var(--chart-dot)", label: "in the middle half" },
  {
    shape: "dot",
    color: "var(--chart-below)",
    label: "small for its mana value (below the middle half)",
  },
  { shape: "band", color: "var(--chart-band)", label: "middle half" },
  { shape: "line", color: "var(--chart-median)", label: "median: this cube’s typical size" },
] as const;

function placeIn(total: number, range: Spread | undefined): "above" | "within" | "below" {
  if (range === undefined || (total >= range.q1 && total <= range.q3)) {
    return "within";
  }
  return total > range.q3 ? "above" : "below";
}

function CreatureBalanceView({
  cards,
  selected,
}: {
  cards: readonly GridCard[];
  selected: string | undefined;
}): ReactNode {
  const balance = creatureBalance(cards);
  const navigate = useNavigate();
  const rows = balance.curve.filter((row) => row.count > 0);
  const columns = balance.curve.flatMap((row) =>
    row.size ? [{ mv: Number(row.id), ...row.size }] : [],
  );
  const spreads = new Map(balance.curve.map((row) => [row.id, row.size]));
  const points = balance.bodies.map((entry) => {
    const key = curveKey(entry.card);
    const range = spreads.get(key);
    const total = size(entry);
    return {
      slug: entry.card.slug,
      name: entry.card.name,
      body: `${String(entry.power)}/${String(entry.toughness)}`,
      mv: Number(key),
      size: total,
      place: placeIn(total, range),
      outlier: range !== undefined && isOutlier(total, range),
    };
  });
  return (
    <div className="creature-balance">
      <div className="stat-tiles" data-testid="creature-tiles">
        <Tile
          label="Creatures"
          value={balance.creatures}
          {...(balance.variable > 0 ? { note: `${String(balance.variable)} vary (* or 0/0)` } : {})}
        />
        <div className="stat-tile">
          <span className="stat-label">Typical body</span>
          <strong className="stat-value">
            {decimal(balance.power)}/{decimal(balance.toughness)}
          </strong>
          <span className="muted stat-note">median power / toughness</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Stats per mana</span>
          <strong className="stat-value">{decimal(balance.perMana)}</strong>
          <span className="muted stat-note">median (power + toughness) ÷ mana value</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Most powerful</span>
          <BodyLink entry={balance.strongest} />
        </div>
        <div className="stat-tile">
          <span className="stat-label">Toughest</span>
          <BodyLink entry={balance.toughest} />
        </div>
        <div className="stat-tile">
          <span className="stat-label">Biggest</span>
          <BodyLink entry={balance.biggest} />
        </div>
        <div className="stat-tile">
          <span className="stat-label">Smallest</span>
          <BodyLink entry={balance.smallest} />
        </div>
      </div>
      <figure className="creature-figure">
        <ul className="creature-legend" aria-hidden="true">
          {LEGEND.map((entry) => (
            <li key={entry.label}>
              <span
                className="legend-swatch"
                data-shape={entry.shape}
                style={{ background: entry.color }}
              />
              {entry.label}
            </li>
          ))}
        </ul>
        <CreatureChart
          points={points}
          columns={columns}
          name="Creature size by mana value"
          tick={curveTick}
          selected={selected}
          onPick={(slug) => {
            void navigate({
              to: ".",
              search: (prev) => ({ ...prev, card: slug }),
              resetScroll: false,
            });
          }}
        />
      </figure>
      <table className="stat-table balance-table">
        <caption>Creatures by mana value</caption>
        <thead>
          <tr>
            <th scope="col">Mana value</th>
            <th scope="col">Creatures</th>
            <th scope="col">Typical</th>
            <th scope="col">Smallest</th>
            <th scope="col">Biggest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-stat={row.id}>
              <th scope="row">{curveTick(row.id)}</th>
              <td>{row.count}</td>
              <td>
                {decimal(row.power)}/{decimal(row.toughness)}
              </td>
              <td>
                <BodyLink entry={row.smallest} />
              </td>
              <td>
                <BodyLink entry={row.biggest} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function percent(part: number, whole: number): string {
  return whole === 0 ? "–" : `${String(Math.round((part / whole) * 100))}%`;
}

const RARE_TYPES: ReadonlySet<string> = new Set(["battle", "other"]);

interface BarBlock {
  kind: BucketKind;
  title: string;
  rows: (stats: CubeStats) => Count[];
  fill: BarFill;
  caption?: () => string;
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
  pt: "Power and toughness",
  body: "Combat matchups",
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
    case "pt":
      return `${ptLabel(first)}/${ptLabel(second)}`;
    case "body":
      return `${first}/${second}`;
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
    if (id === "creature-balance") {
      return (
        <Block
          title="Creature balance"
          caption="Printed bodies, compared with this cube’s own medians so one huge creature can’t skew them. Biggest and smallest go by power + toughness. Creatures with * or 0/0 (they grow with counters or copy something) are left out. Click a dot or name to open the card."
          collapsed={collapsed}
          onToggle={toggle}
        >
          <CreatureBalanceView cards={cards} selected={search.card} />
        </Block>
      );
    }
    if (id === "combat") {
      return (
        <Block
          title="Combat matchups"
          caption="Each dot is a power/toughness, sized by how many creatures have it. It kills a creature when its power is at least that creature’s toughness, and survives one whose power is less than its toughness. Counts the same creatures as the rest of the page; * and 0/0 left out. Click a dot to list its creatures."
          collapsed={collapsed}
          onToggle={toggle}
        >
          <MatchupChart
            points={matchupPoints(cards)}
            name="Combat matchups"
            selected={search.bucket}
            onPick={pick}
          />
        </Block>
      );
    }
    if (id === "pt") {
      const selected =
        bucket?.kind === "pt"
          ? { row: bucket.keys[0] ?? "", column: bucket.keys[1] ?? "" }
          : undefined;
      return (
        <Block
          title="Power and toughness"
          caption="Creatures by power and toughness; * means it varies, like */* or 1+*"
          collapsed={collapsed}
          onToggle={toggle}
          table={
            <CountTable
              caption="Power and toughness"
              rows={stats.powerToughness
                .filter((entry) => entry.count > 0)
                .map((entry) => ({
                  id: bucketId("pt", entry.row, entry.column),
                  label: `${ptLabel(entry.row)}/${ptLabel(entry.column)}`,
                  count: entry.count,
                }))}
              selected={search.bucket}
              onPick={pick}
            />
          }
        >
          <HeatChart
            cells={stats.powerToughness}
            rows={PT_VALUES}
            columns={PT_VALUES}
            name="Power and toughness"
            rowTick={ptTick}
            columnTick={ptTick}
            rowTitle="Power"
            columnTitle="Toughness"
            selected={selected}
            onPick={(row, column) => {
              pick(bucketId("pt", row, column));
            }}
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
        caption={spec.caption?.()}
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
