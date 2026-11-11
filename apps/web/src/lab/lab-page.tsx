import { mode } from "#mode";
import type { CardStatus, Column, ColumnAxis, Filter, Tag } from "@repo/cube/browser";
import { COLUMN_AXES, colorKey, columnsBy, curveKey, newFilterId } from "@repo/cube/browser";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import { useState } from "react";
import { VariantC } from "./variant-c.tsx";
import { z } from "zod";
import { CardLink } from "../card-pane.tsx";
import { Gauge } from "../gauge.tsx";
import { colorIcon, curveTick } from "../insights/labels.tsx";
import { ManaCost } from "../mana.tsx";
import type { GridCard } from "../modes/mode.ts";
import type { Hover } from "../strip.tsx";
import { DRAG_TYPE, Preview, Strip, previewAt } from "../strip.tsx";
import { useRemembered } from "../view-choices.ts";
import type { ChartEvents } from "./lab-charts.tsx";
import { CurveBars, Heat, PtDots } from "./lab-charts.tsx";
import type { Drag, Pill, Test, Used } from "./model.ts";
import {
  allOf,
  curveTallies,
  ghostLabel,
  heatRows,
  project,
  resolvePill,
  usedIn,
} from "./model.ts";

export type Axis = ColumnAxis | "none";

const AXES: { id: Axis; label: string }[] = [...COLUMN_AXES, { id: "none", label: "None" }];

const MANA_VAR: Record<string, string> = {
  W: "var(--mana-w)",
  U: "var(--mana-u)",
  B: "var(--mana-b)",
  R: "var(--mana-r)",
  G: "var(--mana-g)",
  M: "var(--mana-m)",
  C: "var(--mana-c)",
};

export function stripeOf(card: GridCard): string {
  const key = colorKey(card);
  if (key !== "M") {
    return MANA_VAR[key] ?? "var(--mana-c)";
  }
  return `linear-gradient(180deg, ${card.colors.map((color) => MANA_VAR[color] ?? "").join(", ")})`;
}

function flip(status: CardStatus): CardStatus {
  return status === "draft" ? "prospect" : "draft";
}

function byCost(a: GridCard, b: GridCard): number {
  return a.cmc - b.cmc || colorKey(a).localeCompare(colorKey(b)) || a.name.localeCompare(b.name);
}

const COLOR_COLUMN: Record<string, string> = {
  W: "W",
  U: "U",
  B: "B",
  R: "R",
  G: "G",
  C: "colorless",
  M: "multicolored",
};

export function ColumnTitle({ axis, column }: { axis: Axis; column: Column<GridCard> }): ReactNode {
  if (axis === "mv") {
    return <span className="lab-title-symbol">{curveTick(column.id)}</span>;
  }
  const color = axis === "color" ? COLOR_COLUMN[column.id] : undefined;
  if (color !== undefined) {
    return (
      <span className="lab-title-symbol" title={column.label}>
        {colorIcon(color)}
        {(color === "multicolored" || color === "colorless") && (
          <span className="lab-title-text">{column.label}</span>
        )}
      </span>
    );
  }
  return <span>{column.label}</span>;
}

export function groups(cards: readonly GridCard[], axis: Axis): Column<GridCard>[] {
  if (axis === "none") {
    return [{ id: "all", label: "All", cards: cards.toSorted(byCost) }];
  }
  return columnsBy(cards, axis);
}

export interface Lab {
  cards: GridCard[];
  vocabulary: Tag[];
  filters: Filter[];
  saveFilter: ((label: string, query: string) => string) | undefined;
  deleteFilter: ((id: string) => void) | undefined;
  addPill: (key: string) => void;
  used: Used;
  size: { min: number; max: number } | undefined;
  pills: Pill[];
  togglePill: (key: string) => void;
  clearPills: () => void;
  peek: string | undefined;
  setPeek: (key: string | undefined) => void;
  lens: Test | undefined;
  dimmed: (card: GridCard) => boolean;
  hidden: (card: GridCard) => boolean;
  baseline: boolean;
  setBaseline: (on: boolean) => void;
  hide: boolean;
  setHide: (on: boolean) => void;
  showCut: boolean;
  setShowCut: (on: boolean) => void;
  axis: Axis;
  setAxis: (axis: Axis) => void;
  drag: Drag | undefined;
  ghost: Drag | undefined;
  scope: GridCard[];
  next: GridCard[];
  events: ChartEvents;
  hover: Hover | undefined;
  onHover: (hover: Hover | undefined) => void;
  zone: (status: CardStatus) => {
    "data-zone": string;
    "data-over": string | undefined;
    onDragOver: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
  dragRoot: {
    onDragStart: (event: DragEvent) => void;
    onDragEnd: () => void;
  };
}

export function useLab(): Lab | undefined {
  const cube = mode.useCube();
  const filters = mode.useFilters() ?? [];
  const [pillKeys, setPillKeys] = useRemembered("lab.pills", [], z.array(z.string()));
  const [baseline, setBaseline] = useRemembered("lab.baseline", true, z.boolean());
  const [hide, setHide] = useRemembered("lab.hide", false, z.boolean());
  const [showCut, setShowCut] = useRemembered("lab.showCut", false, z.boolean());
  const [axis, setAxis] = useRemembered<Axis>(
    "lab.axis",
    "mv",
    z.enum(["mv", "color", "type", "none"]),
  );
  const [peek, setPeek] = useState<string | undefined>(undefined);
  const [drag, setDrag] = useState<Drag | undefined>(undefined);
  const [hover, setHover] = useState<Hover | undefined>(undefined);
  if (!cube) {
    return undefined;
  }
  const all = cube.cards;
  const cards = all.filter((card) => showCut || card.status !== "cut");
  const pills = pillKeys.flatMap((key) => resolvePill(key, filters) ?? []);
  const peekPill = peek === undefined ? undefined : resolvePill(peek, filters);
  const applied = allOf(pills.map((pill) => pill.test));
  const lens = allOf([...pills, ...(peekPill ? [peekPill] : [])].map((pill) => pill.test));
  const hoverSlug = hover?.card.slug;
  const hovered = hoverSlug === undefined ? undefined : all.find((c) => c.slug === hoverSlug);
  const ghost: Drag | undefined =
    drag ?? (hovered ? { slug: hovered.slug, to: flip(hovered.status) } : undefined);
  const scope = all.filter((card) => card.status === "draft");
  const next = project(all, ghost).filter((card) => card.status === "draft");
  const togglePill = (key: string): void => {
    setPillKeys(
      pillKeys.includes(key) ? pillKeys.filter((other) => other !== key) : [...pillKeys, key],
    );
  };
  const move = mode.moveCard;
  return {
    cards,
    vocabulary: cube.vocabulary,
    filters,
    saveFilter: mode.putFilter
      ? (label, query) => {
          const id = newFilterId(filters);
          mode.putFilter?.({ id, label, query, view: "cards" });
          return id;
        }
      : undefined,
    deleteFilter: mode.deleteFilter
      ? (id) => {
          mode.deleteFilter?.(id);
          setPillKeys(pillKeys.filter((key) => key !== `f:${id}`));
        }
      : undefined,
    addPill: (key) => {
      if (!pillKeys.includes(key)) {
        setPillKeys([...pillKeys, key]);
      }
    },
    used: usedIn([...scope, ...next]),
    size: cube.size,
    pills,
    togglePill,
    clearPills: () => {
      setPillKeys([]);
    },
    peek,
    setPeek,
    lens,
    dimmed: (card) => (peekPill ? !lens?.(card) : !hide && applied !== undefined && !applied(card)),
    hidden: (card) => hide && !peekPill && applied !== undefined && !applied(card),
    baseline,
    setBaseline,
    hide,
    setHide,
    showCut,
    setShowCut,
    axis,
    setAxis,
    drag,
    ghost,
    scope,
    next,
    events: {
      onPeek: setPeek,
      onPick: (key) => {
        togglePill(key);
        setPeek(undefined);
      },
      baseline,
      filtered: lens !== undefined,
    },
    hover,
    onHover: setHover,
    zone: (status) => ({
      "data-zone": status,
      "data-over": drag?.to === status ? "" : undefined,
      onDragOver: (event) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE) || !drag) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        const card = all.find((candidate) => candidate.slug === drag.slug);
        const to = card && card.status !== status ? status : undefined;
        if (drag.to !== to) {
          setDrag({ slug: drag.slug, to });
        }
      },
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        const card = all.find((candidate) => candidate.slug === drag?.slug);
        if (card && card.status !== status && move) {
          move(card, status);
        }
        setDrag(undefined);
      },
    }),
    dragRoot: {
      onDragStart: (event) => {
        const slug = event.dataTransfer.getData(DRAG_TYPE);
        if (slug) {
          setHover(undefined);
          setDrag({ slug });
        }
      },
      onDragEnd: () => {
        setDrag(undefined);
      },
    },
  };
}

export function DraftCount({ lab }: { lab: Lab }): ReactNode {
  const now = lab.scope.length;
  const later = lab.next.length;
  return (
    <div className="lab-count">
      <span className="lab-count-label">Draft</span>
      <strong className="lab-count-value">{now}</strong>
      <span
        className="lab-count-ghost"
        data-up={later > now ? "" : undefined}
        data-idle={later === now ? "" : undefined}
      >
        → {later}
      </span>
      {lab.size && <Gauge count={later} size={lab.size} />}
    </div>
  );
}

export function PillBar({ lab }: { lab: Lab }): ReactNode {
  return (
    <div className="lab-pills" aria-label="Applied filters">
      {lab.pills.length === 0 && (
        <span className="lab-pills-empty">No filter · hover a chart or filter to peek</span>
      )}
      {lab.pills.map((pill) => (
        <button
          key={pill.key}
          type="button"
          className="lab-pill"
          onClick={() => {
            lab.togglePill(pill.key);
          }}
          onPointerEnter={() => {
            lab.setPeek(undefined);
          }}
          aria-label={`Remove ${pill.label}`}
        >
          {pill.label} <span aria-hidden>×</span>
        </button>
      ))}
      {lab.pills.length > 1 && (
        <button type="button" className="lab-link" onClick={lab.clearPills}>
          Clear
        </button>
      )}
    </div>
  );
}

export function Switches({ lab }: { lab: Lab }): ReactNode {
  return (
    <div className="lab-switches">
      <label>
        <input
          type="checkbox"
          checked={lab.baseline}
          onChange={(event) => {
            lab.setBaseline(event.target.checked);
          }}
        />
        Baseline
      </label>
      <label>
        <input
          type="checkbox"
          checked={lab.hide}
          onChange={(event) => {
            lab.setHide(event.target.checked);
          }}
        />
        Hide non-matches
      </label>
      <label>
        <input
          type="checkbox"
          checked={lab.showCut}
          onChange={(event) => {
            lab.setShowCut(event.target.checked);
          }}
        />
        Show cut
      </label>
    </div>
  );
}

export function AxisTabs({ lab, className }: { lab: Lab; className: string }): ReactNode {
  return (
    <div className={className} role="group" aria-label="Group by">
      {AXES.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.id === lab.axis}
          className={option.id === lab.axis ? "on" : undefined}
          onClick={() => {
            lab.setAxis(option.id);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FilterList({
  lab,
  className,
  onRemove,
}: {
  lab: Lab;
  className: string;
  onRemove?: ((id: string) => void) | undefined;
}): ReactNode {
  const draft = lab.scope.length || 1;
  const entries = [
    ...lab.filters.map((filter) => ({ key: `f:${filter.id}`, id: filter.id, label: filter.label })),
  ];
  return (
    <div className={className}>
      {entries.map((entry) => {
        const pill = resolvePill(entry.key, lab.filters);
        const count = pill ? lab.scope.filter(pill.test).length : 0;
        const on = lab.pills.some((applied) => applied.key === entry.key);
        return (
          <div key={entry.key} className="lab-filter-entry">
            <button
              type="button"
              className={on ? "on" : undefined}
              aria-pressed={on}
              title={lab.filters.find((filter) => `f:${filter.id}` === entry.key)?.query}
              onPointerEnter={() => {
                lab.setPeek(entry.key);
              }}
              onPointerLeave={() => {
                lab.setPeek(undefined);
              }}
              onClick={() => {
                lab.togglePill(entry.key);
                lab.setPeek(undefined);
              }}
            >
              <span className="lab-filter-name">{entry.label}</span>
              <span className="lab-filter-count">{count}</span>
              <span className="lab-filter-bar">
                <i style={{ width: `${String((count / draft) * 100)}%` }} />
              </span>
            </button>
            {onRemove && (
              <button
                type="button"
                className="lab-filter-remove"
                aria-label={`Delete ${entry.label}`}
                onClick={() => {
                  onRemove(entry.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StripColumns({
  lab,
  cards,
  compact,
}: {
  lab: Lab;
  cards: readonly GridCard[];
  compact: boolean;
}): ReactNode {
  const shown = cards.filter((card) => !lab.hidden(card));
  const columns = groups(shown, lab.axis).filter((column) => column.cards.length > 0);
  return (
    <div
      className="lab-columns"
      data-compact={compact ? "" : undefined}
      style={{ "--columns": columns.length } as CSSProperties}
    >
      {columns.map((column) => {
        const lit = column.cards.filter((card) => !lab.dimmed(card)).length;
        return (
          <section key={column.id} className="lab-column">
            <header className="lab-column-head">
              <ColumnTitle axis={lab.axis} column={column} />
              <span className="lab-column-count">
                {lit === column.cards.length
                  ? lit
                  : `${String(lit)}/${String(column.cards.length)}`}
              </span>
            </header>
            <ul className="stack">
              {column.cards.map((card) => (
                <Strip key={card.slug} card={card} onHover={lab.onHover} dim={lab.dimmed(card)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function VariantA({ lab }: { lab: Lab }): ReactNode {
  const draft = lab.cards.filter((card) => card.status === "draft");
  const prospects = lab.cards.filter((card) => card.status !== "draft");
  return (
    <div className="lab lab-a" {...lab.dragRoot}>
      <header className="lab-a-top">
        <h1>Lab</h1>
        <DraftCount lab={lab} />
        <PillBar lab={lab} />
        <Switches lab={lab} />
      </header>
      <div className="lab-a-instruments">
        <section className="lab-a-tile lab-a-filters">
          <h2>Filters</h2>
          <FilterList lab={lab} className="lab-a-filter-list" />
        </section>
        <section className="lab-a-tile">
          <h2>Curve</h2>
          <CurveBars
            tallies={curveTallies(lab.scope, lab.next, lab.lens)}
            events={lab.events}
            used={lab.used}
          />
        </section>
        <section className="lab-a-tile lab-a-wide">
          <h2>Color × mana value</h2>
          <Heat
            rows={heatRows(lab.scope, lab.next, lab.lens)}
            events={lab.events}
            used={lab.used}
          />
        </section>
        <section className="lab-a-tile">
          <h2>Power × toughness</h2>
          <PtDots
            scope={lab.scope}
            next={lab.next}
            lens={lab.lens}
            events={lab.events}
            used={lab.used}
          />
        </section>
      </div>
      <div className="lab-a-floor">
        <section className="lab-a-draft" {...lab.zone("draft")}>
          <header className="lab-a-floor-head">
            <h2>Draft</h2>
            <AxisTabs lab={lab} className="segmented" />
          </header>
          <StripColumns lab={lab} cards={draft} compact={false} />
        </section>
        <section className="lab-a-prospects" {...lab.zone("prospect")}>
          <header className="lab-a-floor-head">
            <h2>
              Prospects <span className="muted">{prospects.length}</span>
            </h2>
          </header>
          <StripColumns lab={lab} cards={prospects} compact />
        </section>
      </div>
      <Preview hover={lab.hover} />
    </div>
  );
}

export function Row({ lab, card }: { lab: Lab; card: GridCard }): ReactNode {
  const tags = card.tags
    .slice(0, 3)
    .map((id) => lab.vocabulary.find((tag) => tag.id === id)?.label ?? id);
  const pt = card.power === undefined ? "" : `${card.power}/${card.toughness ?? ""}`;
  return (
    <li className="lab-row-cell" data-dim={lab.dimmed(card) ? "" : undefined}>
      <CardLink
        slug={card.slug}
        className="lab-row"
        style={{ "--stripe": stripeOf(card) } as CSSProperties}
        draggable={mode.moveCard !== undefined}
        onDragStart={(event: DragEvent<HTMLAnchorElement>) => {
          event.dataTransfer.setData(DRAG_TYPE, card.slug);
          event.dataTransfer.effectAllowed = "move";
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") {
            lab.onHover(previewAt(card, event.currentTarget.getBoundingClientRect()));
          }
        }}
        onPointerLeave={() => {
          lab.onHover(undefined);
        }}
      >
        <span className="lab-row-stripe" />
        <span className="lab-row-cost">
          <ManaCost cost={card.manaCost} />
        </span>
        <span className="lab-row-name">{card.name}</span>
        <span className="lab-row-type">{card.typeLine.split("—")[0]?.trim()}</span>
        <span className="lab-row-pt">{pt}</span>
        <span className="lab-row-tags">
          {tags.map((tag) => (
            <span key={tag} className="lab-tag">
              {tag}
            </span>
          ))}
        </span>
      </CardLink>
    </li>
  );
}

export function RowGroups({ lab, cards }: { lab: Lab; cards: readonly GridCard[] }): ReactNode {
  const shown = cards.filter((card) => !lab.hidden(card));
  const columns = groups(shown, lab.axis).filter((column) => column.cards.length > 0);
  return columns.map((column) => {
    const lit = column.cards.filter((card) => !lab.dimmed(card)).length;
    return (
      <div key={column.id} className="lab-b-group">
        <header>
          <ColumnTitle axis={lab.axis} column={column} />
          <span className="n">
            {lit === column.cards.length ? lit : `${String(lit)} of ${String(column.cards.length)}`}
          </span>
        </header>
        <ul className="lab-b-rows">
          {column.cards.map((card) => (
            <Row key={card.slug} lab={lab} card={card} />
          ))}
        </ul>
      </div>
    );
  });
}

function VariantB({ lab }: { lab: Lab }): ReactNode {
  const draft = lab.cards.filter((card) => card.status === "draft");
  const prospects = lab.cards.filter((card) => card.status === "prospect");
  const cut = lab.cards.filter((card) => card.status === "cut");
  const [tab, setTab] = useState<"draft" | "prospect">("draft");
  const tagCounts = lab.vocabulary
    .map((tag) => ({ tag, count: lab.scope.filter((card) => card.tags.includes(tag.id)).length }))
    .filter((entry) => entry.count > 0)
    .toSorted((a, b) => b.count - a.count)
    .slice(0, 14);
  const live = lab.lens !== undefined;
  return (
    <div className="lab lab-b" {...lab.dragRoot}>
      <aside className="lab-b-rail">
        <h4>Cards</h4>
        {(
          [
            ["draft", "Draft", draft.length],
            ["prospect", "Prospects", prospects.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            className={`lab-b-nav${tab === id ? " on" : ""}`}
            {...lab.zone(id)}
            onClick={() => {
              setTab(id);
            }}
          >
            <span>{label}</span>
            <span className="count">{count}</span>
          </button>
        ))}
        {lab.showCut && (
          <div className="lab-b-nav off">
            <span>Cut</span>
            <span className="count">{cut.length}</span>
          </div>
        )}
        <h4>Filters</h4>
        <FilterList lab={lab} className="lab-b-filters" />
        <h4>Tags in draft</h4>
        <div className="lab-b-chips">
          {tagCounts.map(({ tag, count }) => {
            const key = `tag:${tag.id}`;
            const on = lab.pills.some((pill) => pill.key === key);
            return (
              <button
                key={tag.id}
                type="button"
                className={`lab-b-chip${on ? " on" : ""}`}
                onPointerEnter={() => {
                  lab.setPeek(key);
                }}
                onPointerLeave={() => {
                  lab.setPeek(undefined);
                }}
                onClick={() => {
                  lab.togglePill(key);
                  lab.setPeek(undefined);
                }}
              >
                {tag.label} <span>{count}</span>
              </button>
            );
          })}
        </div>
      </aside>
      <main className="lab-b-main">
        <div className="lab-b-head">
          <h1>
            Lab <span className="lab-b-live" data-live={live ? "" : undefined} />
          </h1>
          <DraftCount lab={lab} />
        </div>
        <div className="lab-b-toolbar">
          <div className="lab-b-tabs" role="tablist">
            {(
              [
                ["draft", "Draft", draft.length],
                ["prospect", "Prospects", prospects.length],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? "on" : undefined}
                {...lab.zone(id)}
                onClick={() => {
                  setTab(id);
                }}
              >
                {label} <span className="count">{count}</span>
              </button>
            ))}
          </div>
          <AxisTabs lab={lab} className="lab-b-seg" />
          <Switches lab={lab} />
        </div>
        <PillBar lab={lab} />
        <div className="lab-b-list" {...lab.zone(tab)}>
          <RowGroups lab={lab} cards={tab === "draft" ? draft : prospects} />
        </div>
      </main>
      <aside className="lab-b-panel">
        <section className="lab-b-box">
          <h5>
            Curve <span className="n">{live ? "filtered · baseline faint" : "draft"}</span>
          </h5>
          <CurveBars
            tallies={curveTallies(lab.scope, lab.next, lab.lens)}
            events={lab.events}
            used={lab.used}
          />
        </section>
        <section className="lab-b-box">
          <h5>Color × mana value</h5>
          <Heat
            rows={heatRows(lab.scope, lab.next, lab.lens)}
            events={lab.events}
            used={lab.used}
          />
        </section>
        <section className="lab-b-box">
          <h5>Power × toughness</h5>
          <PtDots
            scope={lab.scope}
            next={lab.next}
            lens={lab.lens}
            events={lab.events}
            used={lab.used}
          />
        </section>
        {lab.ghost?.to && (
          <p className="lab-b-hint">
            {lab.drag ? "Dropping" : "Moving"} this card to {lab.ghost.to}:{" "}
            {ghostLabel(lab.next.length - lab.scope.length)} draft · MV{" "}
            {curveKey(lab.cards.find((card) => card.slug === lab.ghost?.slug) ?? { cmc: 0 })}
          </p>
        )}
      </aside>
      <Preview hover={lab.hover} />
    </div>
  );
}

export function LabPage(): ReactNode {
  const lab = useLab();
  const { variant } = useSearch({ from: "/lab" });
  const navigate = useNavigate();
  if (!lab) {
    return <p className="muted">Loading cube…</p>;
  }
  const chosen = variant === "b" ? "b" : variant === "c" ? "c" : "a";
  return (
    <>
      <div className="lab-variant" role="group" aria-label="Spike variant">
        {(["a", "b", "c"] as const).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={chosen === id}
            onClick={() => {
              void navigate({ to: "/lab", search: (prev) => ({ ...prev, variant: id }) });
            }}
          >
            Variant {id.toUpperCase()}
          </button>
        ))}
      </div>
      {chosen === "a" && <VariantA lab={lab} />}
      {chosen === "b" && <VariantB lab={lab} />}
      {chosen === "c" && <VariantC lab={lab} />}
    </>
  );
}
