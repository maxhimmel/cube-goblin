import { mode } from "#mode";
import type { Body, Filter, Spread } from "@repo/cube/browser";
import {
  COLOR_GROUPS,
  CURVE_COLUMNS,
  combatMatchups,
  creatureBalance,
  curveKey,
  isOutlier,
  size,
  PT_VALUES,
  bucketId,
  cubeStats,
  filterCards,
  narrowTo,
  newFilterId,
  parseBucket,
} from "@repo/cube/browser";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Responsive, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import type { ReactNode } from "react";
import { useState } from "react";
import { CardLink } from "../card-pane.tsx";
import { Gauge } from "../gauge.tsx";
import type { GridCard } from "../modes/mode.ts";
import { Block } from "./block.tsx";
import { BucketPanel } from "./bucket-panel.tsx";
import { CountTable, CreatureChart, HeatChart, MatchupChart } from "./charts.tsx";
import type { BlockId, Dashboard } from "./layout.ts";
import {
  BLOCKS,
  BREAKPOINTS,
  COLS,
  FILTER_BLOCK_PREFIX,
  ROW_HEIGHT,
  filterBlock,
  filterBlockId,
  shown,
  useDashboard,
} from "./layout.ts";
import {
  KIND_TITLES,
  bucketLabel,
  colorLabel,
  colorTick,
  curveLabel,
  curveTick,
  ptLabel,
  ptTick,
} from "./labels.tsx";
import { BlockBody, BlocksMenu, FilterBlock, FilterEditor, isBlockId } from "./filter-widgets.tsx";
import type { CardSet, FrameComponent } from "./filter-widgets.tsx";

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

function DashboardGrid({
  dashboard,
  render,
}: {
  dashboard: Dashboard;
  render: (id: string) => ReactNode;
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
          {dashboard.visible.map((block) => (
            <div key={block.id} className="block-cell" data-block={block.id}>
              {render(block.id)}
            </div>
          ))}
        </Responsive>
      )}
    </div>
  );
}

export interface BlockUi {
  collapsed: boolean;
  onToggle: () => void;
  onHide?: (() => void) | undefined;
  selectedCard: string | undefined;
}

function chartBlock(id: BlockId, set: CardSet, Frame: FrameComponent, ui: BlockUi): ReactNode {
  const { cards, stats, bucket, pick } = set;
  const collapsed = ui.collapsed;
  const toggle = ui.onToggle;
  const hide = ui.onHide;
  if (id === "creature-balance") {
    return (
      <Frame
        title="Creature balance"
        caption="Printed bodies, compared with this cube’s own medians so one huge creature can’t skew them. Biggest and smallest go by power + toughness. Creatures with * or 0/0 (they grow with counters or copy something) are left out. Click a dot or name to open the card."
        collapsed={collapsed}
        onToggle={toggle}
        onHide={hide}
      >
        <CreatureBalanceView cards={cards} selected={ui.selectedCard} />
      </Frame>
    );
  }
  if (id === "combat") {
    return (
      <Frame
        title="Combat matchups"
        caption="Each dot is a power/toughness, sized by how many creatures have it. It kills a creature when its power is at least that creature’s toughness, and survives one whose power is less than its toughness. Counts the same creatures as the rest of the page; * and 0/0 left out. Click a dot to list its creatures."
        collapsed={collapsed}
        onToggle={toggle}
        onHide={hide}
      >
        <MatchupChart
          points={matchupPoints(cards)}
          name="Combat matchups"
          selected={set.selectedBucket}
          onPick={pick}
        />
      </Frame>
    );
  }
  if (id === "pt") {
    const selected =
      bucket?.kind === "pt"
        ? { row: bucket.keys[0] ?? "", column: bucket.keys[1] ?? "" }
        : undefined;
    return (
      <Frame
        title="Power and toughness"
        caption="Creatures by power and toughness; * means it varies, like */* or 1+*"
        collapsed={collapsed}
        onToggle={toggle}
        onHide={hide}
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
            selected={set.selectedBucket}
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
      </Frame>
    );
  }
  const selected =
    bucket?.kind === "colorCurve"
      ? { row: bucket.keys[0] ?? "", column: bucket.keys[1] ?? "" }
      : undefined;
  return (
    <Frame
      title="Color by mana value"
      caption="Nonland cards by color and mana value; stronger color means more"
      collapsed={collapsed}
      onToggle={toggle}
      onHide={hide}
      table={
        <CountTable
          caption="Color by mana value"
          rows={stats.colorCurve.map((entry) => ({
            id: bucketId("colorCurve", entry.row, entry.column),
            label: `${colorLabel(entry.row)}, ${curveLabel(entry.column)}`,
            count: entry.count,
          }))}
          selected={set.selectedBucket}
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
    </Frame>
  );
}

export function InsightsPage(): ReactNode {
  const cube = mode.useCube();
  const selection = mode.useSelection();
  const filters = mode.useFilters() ?? [];
  const search = useSearch({ from: "/insights" });
  const navigate = useNavigate();
  const dashboard = useDashboard([
    ...BLOCKS,
    ...filters.map((filter) => filterBlock(filter.id, filter.label)),
  ]);
  const [editing, setEditing] = useState<Filter | undefined>(undefined);
  if (!cube) {
    return <p className="muted">Loading cube…</p>;
  }
  const scopes = SCOPES.filter((option) => option.id !== "selected" || mode.name === "workbench");
  const scope = scopes.find((option) => option.id === search.scope) ?? scopes[0];
  const cards = scope ? cube.cards.filter((card) => scope.includes(card, selection)) : [];
  const stats = cubeStats(cards, cube.vocabulary);
  const drafted = cube.cards.filter((card) => card.status === "draft").length;
  const bucket = search.bucket === undefined ? undefined : parseBucket(search.bucket);
  const panelFilter = filters.find((filter) => filter.id === search.in);
  const filterCardsOf = (filter: Filter): GridCard[] => filterCards(filter, cube.cards, cards);

  const pickIn =
    (filterId: string | undefined) =>
    (id: string): void => {
      void navigate({
        to: "/insights",
        search: (prev) => {
          const same = prev.bucket === id && prev.in === filterId;
          return { ...prev, bucket: same ? undefined : id, in: same ? undefined : filterId };
        },
        resetScroll: false,
      });
    };
  const closeBucket = (): void => {
    void navigate({
      to: "/insights",
      search: (prev) => ({ ...prev, bucket: undefined, in: undefined }),
      resetScroll: false,
    });
  };
  const pageSet: CardSet = {
    cards,
    stats,
    bucket: panelFilter ? undefined : bucket,
    selectedBucket: panelFilter ? undefined : search.bucket,
    pick: pickIn(undefined),
  };
  const filterSet = (filter: Filter): CardSet => {
    const own = filterCardsOf(filter);
    const mine = search.in === filter.id;
    return {
      cards: own,
      stats: cubeStats(own, cube.vocabulary),
      bucket: mine ? bucket : undefined,
      selectedBucket: mine ? search.bucket : undefined,
      pick: pickIn(filter.id),
    };
  };
  const panelCards = panelFilter ? filterCardsOf(panelFilter) : cards;
  const startNew = (query = "", label = ""): void => {
    setEditing({ id: newFilterId(filters), label, query, view: "cards" });
  };

  const renderBlock = (id: BlockId, set: CardSet, Frame: FrameComponent): ReactNode =>
    chartBlock(id, set, Frame, {
      collapsed: dashboard.collapsed.has(id),
      onToggle: () => {
        dashboard.toggle(id);
      },
      onHide: () => {
        dashboard.setHidden(id, true);
      },
      selectedCard: search.card,
    });

  const render = (id: string): ReactNode => {
    if (id.startsWith(FILTER_BLOCK_PREFIX)) {
      const filter = filters.find((entry) => filterBlockId(entry.id) === id);
      return (
        filter && (
          <FilterBlock
            filter={filter}
            set={filterSet(filter)}
            collapsed={dashboard.collapsed.has(id)}
            onToggle={() => {
              dashboard.toggle(id);
            }}
            onHide={() => {
              dashboard.setHidden(id, true);
            }}
            onEdit={
              mode.putFilter
                ? () => {
                    setEditing(filter);
                  }
                : undefined
            }
            onView={
              mode.putFilter
                ? (view) => {
                    void mode.putFilter?.({ ...filter, view });
                  }
                : undefined
            }
            renderChart={(chart, set) => renderBlock(chart, set, BlockBody)}
          />
        )
      );
    }
    return isBlockId(id) ? renderBlock(id, pageSet, Block) : null;
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
        {mode.putFilter && (
          <button
            type="button"
            className="toolbar-link"
            onClick={() => {
              startNew();
            }}
          >
            + New filter
          </button>
        )}
        <BlocksMenu dashboard={dashboard} />
        <button type="button" className="toolbar-link" onClick={dashboard.reset}>
          Reset layout
        </button>
      </div>
      <div className="insights-body">
        <DashboardGrid dashboard={dashboard} render={render} />
        {bucket && (
          <BucketPanel
            bucket={bucket}
            title={
              panelFilter
                ? `${panelFilter.label} · ${KIND_TITLES[bucket.kind]}`
                : KIND_TITLES[bucket.kind]
            }
            label={bucketLabel(bucket, stats)}
            cards={panelCards}
            onClose={closeBucket}
            onSave={
              mode.putFilter
                ? () => {
                    startNew(
                      narrowTo(panelFilter?.query ?? "", bucket),
                      panelFilter
                        ? `${panelFilter.label}: ${bucketLabel(bucket, stats)}`
                        : bucketLabel(bucket, stats),
                    );
                  }
                : undefined
            }
          />
        )}
      </div>
      {editing && (
        <FilterEditor
          key={editing.id}
          filter={editing}
          isNew={!filters.some((entry) => entry.id === editing.id)}
          cards={cube.cards}
          scoped={cards}
          vocabulary={cube.vocabulary}
          onSave={(filter) => {
            void mode.putFilter?.(filter);
            dashboard.setHidden(filterBlockId(filter.id), false);
            setTimeout(() => {
              document
                .querySelector(`[data-block="${filterBlockId(filter.id)}"]`)
                ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }, 150);
          }}
          onDelete={
            mode.deleteFilter
              ? (id) => {
                  mode.deleteFilter?.(id);
                }
              : undefined
          }
          onClose={() => {
            setEditing(undefined);
          }}
        />
      )}
    </div>
  );
}
