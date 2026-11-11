import { compileQuery, cubeStats } from "@repo/cube/browser";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { z } from "zod";
import type { Block } from "../insights/block.tsx";
import type { CardSet } from "../insights/filter-widgets.tsx";
import { chartBlock } from "../insights/insights-page.tsx";
import type { BlockId } from "../insights/layout.ts";
import { BLOCKS } from "../insights/layout.ts";
import { QueryInput } from "../query/query-input.tsx";
import { useRemembered } from "../view-choices.ts";
import { CurveBars, Heat, PtDots } from "./lab-charts.tsx";
import { curveTallies, heatRows, resolvePill } from "./model.ts";
import type { Lab } from "./use-lab.ts";

export const DOCKS = ["top", "right", "bottom", "left"] as const;
export type Dock = (typeof DOCKS)[number];

const BLOCK_DRAG = "application/x-lab-block";

const LAB_BLOCKS = [
  { id: "lab:filters", title: "Filters" },
  { id: "lab:tags", title: "Tags in draft" },
  { id: "lab:curve", title: "Curve" },
  { id: "lab:heat", title: "Color × mana value" },
  { id: "lab:pt", title: "Power × toughness" },
] as const;

const DUPLICATES = new Set(["curve", "heat", "pt", "status"]);

const ALL_BLOCKS: { id: string; title: string; h?: number }[] = [
  ...LAB_BLOCKS,
  ...BLOCKS.map((block) => ({ id: block.id, title: block.title, h: block.h })),
];

const DEFAULT_ORDER = [
  ...LAB_BLOCKS.map((block) => block.id),
  "combat",
  "creature-balance",
  "color",
  "heavy",
  "types",
  "groups",
  "archetypes",
  "summary",
  "curve",
  "heat",
  "pt",
  "status",
];

const DEFAULT_HIDDEN = [...DUPLICATES];

const BLOCK_IDS = new Set<string>(BLOCKS.map((block) => block.id));

function isInsightsBlock(id: string): id is BlockId {
  return BLOCK_IDS.has(id);
}

function FilterList({ lab }: { lab: Lab }): ReactNode {
  const draft = lab.scope.length || 1;
  return (
    <div className="lab-filter-list">
      {lab.filters.map((filter) => {
        const key = `f:${filter.id}`;
        const pill = resolvePill(key, lab.filters);
        const count = pill ? lab.scope.filter(pill.test).length : 0;
        const on = lab.pills.some((applied) => applied.key === key);
        return (
          <div key={key} className="lab-filter-entry">
            <button
              type="button"
              className={on ? "on" : undefined}
              aria-pressed={on}
              title={filter.query}
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
              <span className="lab-filter-name">{filter.label}</span>
              <span className="lab-filter-count">{count}</span>
              <span className="lab-filter-bar">
                <i style={{ width: `${String((count / draft) * 100)}%` }} />
              </span>
            </button>
            {lab.deleteFilter && (
              <button
                type="button"
                className="lab-filter-remove"
                aria-label={`Delete ${filter.label}`}
                onClick={() => {
                  lab.deleteFilter?.(filter.id);
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

function NewFilter({ lab, onDone }: { lab: Lab; onDone: () => void }): ReactNode {
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const result = compileQuery(query);
  const count = result.ok ? lab.scope.filter(result.test).length : undefined;
  const save = lab.saveFilter;
  const ready = save !== undefined && result.ok && label.trim() !== "" && query.trim() !== "";
  return (
    <form
      className="lab-new-filter"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) {
          save(label.trim(), query);
          onDone();
        }
      }}
    >
      <input
        value={label}
        placeholder="Name"
        aria-label="Filter name"
        autoFocus
        onChange={(event) => {
          setLabel(event.target.value);
        }}
      />
      <QueryInput
        initial=""
        onChange={setQuery}
        vocabulary={lab.vocabulary}
        label="New filter query"
        status={count === undefined ? undefined : `${String(count)} in draft`}
      />
      <div className="lab-new-filter-foot">
        <button type="button" className="lab-link" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" disabled={!ready}>
          Save
        </button>
      </div>
    </form>
  );
}

function FiltersBody({ lab }: { lab: Lab }): ReactNode {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <FilterList lab={lab} />
      {adding ? (
        <NewFilter
          lab={lab}
          onDone={() => {
            setAdding(false);
          }}
        />
      ) : (
        lab.saveFilter && (
          <button
            type="button"
            className="lab-add"
            onClick={() => {
              setAdding(true);
            }}
          >
            + New filter
          </button>
        )
      )}
    </>
  );
}

function TagsBody({ lab }: { lab: Lab }): ReactNode {
  const counts = lab.vocabulary
    .map((tag) => ({ tag, count: lab.scope.filter((card) => card.tags.includes(tag.id)).length }))
    .filter((entry) => entry.count > 0)
    .toSorted((a, b) => b.count - a.count);
  return (
    <div className="lab-chips">
      {counts.map(({ tag, count }) => {
        const key = `tag:${tag.id}`;
        const on = lab.pills.some((pill) => pill.key === key);
        return (
          <button
            key={tag.id}
            type="button"
            className={`lab-chip${on ? " on" : ""}`}
            aria-pressed={on}
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
  );
}

export interface DockState {
  order: string[];
  hidden: Set<string>;
  collapsed: Set<string>;
  move: (id: string, before: string) => void;
  setHidden: (id: string, hide: boolean) => void;
  toggle: (id: string) => void;
  reset: () => void;
}

export function useDockState(): DockState {
  const ids = z.array(z.string());
  const [order, setOrder] = useRemembered("labc.order", DEFAULT_ORDER, ids);
  const [hidden, setHidden] = useRemembered("labc.hidden", DEFAULT_HIDDEN, ids);
  const [collapsed, setCollapsed] = useRemembered<string[]>("labc.collapsed", [], ids);
  const known = [
    ...order.filter((id) => ALL_BLOCKS.some((block) => block.id === id)),
    ...ALL_BLOCKS.map((block) => block.id).filter((id) => !order.includes(id)),
  ];
  return {
    order: known,
    hidden: new Set(hidden),
    collapsed: new Set(collapsed),
    move: (id, before) => {
      if (id === before) {
        return;
      }
      const rest = known.filter((other) => other !== id);
      const at = rest.indexOf(before);
      setOrder([...rest.slice(0, at), id, ...rest.slice(at)]);
    },
    setHidden: (id, hide) => {
      setHidden(hide ? [...hidden, id] : hidden.filter((other) => other !== id));
    },
    toggle: (id) => {
      setCollapsed(
        collapsed.includes(id) ? collapsed.filter((other) => other !== id) : [...collapsed, id],
      );
    },
    reset: () => {
      setOrder(DEFAULT_ORDER);
      setHidden(DEFAULT_HIDDEN);
      setCollapsed([]);
    },
  };
}

export function BlocksMenu({ dock }: { dock: DockState }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <div className="lab-menu">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        Blocks{dock.hidden.size > 0 && ` · ${String(dock.hidden.size)} hidden`}
      </button>
      {open && (
        <div className="lab-menu-list">
          {dock.order.map((id) => {
            const block = ALL_BLOCKS.find((entry) => entry.id === id);
            return (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={!dock.hidden.has(id)}
                  onChange={(event) => {
                    dock.setHidden(id, !event.target.checked);
                  }}
                />
                {block?.title ?? id}
                {DUPLICATES.has(id) && <span className="muted"> (Insights)</span>}
              </label>
            );
          })}
          <button type="button" className="lab-link" onClick={dock.reset}>
            Reset blocks
          </button>
        </div>
      )}
    </div>
  );
}

function DockBlock({
  id,
  dock,
  dragging,
  setDragging,
  children,
  height,
}: {
  id: string;
  dock: DockState;
  dragging: string | undefined;
  setDragging: (id: string | undefined) => void;
  children: ReactNode;
  height: number | undefined;
}): ReactNode {
  const [grab, setGrab] = useState(false);
  const [over, setOver] = useState(false);
  return (
    <div
      className="lab-block"
      data-block={id}
      data-insights={id.startsWith("lab:") ? undefined : ""}
      data-dragging={dragging === id ? "" : undefined}
      data-over={over && dragging !== id ? "" : undefined}
      style={
        height === undefined ? undefined : ({ "--block-h": `${String(height)}px` } as CSSProperties)
      }
      draggable={grab}
      onPointerDown={(event) => {
        setGrab((event.target as HTMLElement).closest(".block-head") !== null);
      }}
      onDragStart={(event) => {
        if (!grab) {
          return;
        }
        event.stopPropagation();
        event.dataTransfer.setData(BLOCK_DRAG, id);
        event.dataTransfer.effectAllowed = "move";
        setDragging(id);
      }}
      onDragEnd={() => {
        setGrab(false);
        setDragging(undefined);
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(BLOCK_DRAG)) {
          event.preventDefault();
          event.stopPropagation();
          setOver(true);
        }
      }}
      onDragLeave={() => {
        setOver(false);
      }}
      onDrop={(event) => {
        const from = event.dataTransfer.getData(BLOCK_DRAG);
        if (from) {
          event.preventDefault();
          event.stopPropagation();
          dock.move(from, id);
        }
        setOver(false);
        setDragging(undefined);
      }}
    >
      {children}
    </div>
  );
}

const SHORT_CAPTION = 40;

function Tile({
  title,
  caption,
  table,
  collapsed,
  onToggle,
  onHide,
  actions,
  children,
}: Parameters<typeof Block>[0]): ReactNode {
  const [asTable, setAsTable] = useState(false);
  const short = typeof caption === "string" && caption.length <= SHORT_CAPTION;
  return (
    <section className="lab-tile" data-collapsed={collapsed ? "" : undefined} aria-label={title}>
      <header className="block-head lab-tile-head">
        <h2 title={typeof caption === "string" && !short ? caption : undefined}>{title}</h2>
        {short && !collapsed && <span className="lab-tile-caption">{caption}</span>}
        <span className="lab-tile-actions">
          {!collapsed && actions}
          {table !== undefined && !collapsed && (
            <button
              type="button"
              aria-pressed={asTable}
              title="Table"
              onClick={() => {
                setAsTable(!asTable);
              }}
            >
              ▤
            </button>
          )}
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            onClick={onToggle}
          >
            {collapsed ? "+" : "–"}
          </button>
          {onHide && (
            <button type="button" aria-label={`Hide ${title}`} onClick={onHide}>
              ×
            </button>
          )}
        </span>
      </header>
      {!collapsed && <div className="lab-tile-body">{asTable ? table : children}</div>}
    </section>
  );
}

export function DockBlocks({ lab, dock }: { lab: Lab; dock: DockState }): ReactNode {
  const [dragging, setDragging] = useState<string | undefined>(undefined);
  const lensed = lab.lens ? lab.scope.filter(lab.lens) : lab.scope;
  const set: CardSet = {
    cards: lensed,
    stats: cubeStats(lensed, lab.vocabulary),
    bucket: undefined,
    selectedBucket: undefined,
    pick: (key) => {
      lab.events.onPick(key);
    },
  };
  const controls = (id: string) => ({
    collapsed: dock.collapsed.has(id),
    onToggle: () => {
      dock.toggle(id);
    },
    onHide: () => {
      dock.setHidden(id, true);
    },
  });
  const caption = lab.lens !== undefined ? "filtered · baseline faint" : "draft";
  const tile = (id: string, title: string, body: ReactNode, live?: boolean): ReactNode => (
    <Tile title={title} caption={live ? caption : undefined} {...controls(id)}>
      {body}
    </Tile>
  );
  const body = (id: string): ReactNode => {
    switch (id) {
      case "lab:filters":
        return tile(id, "Filters", <FiltersBody lab={lab} />);
      case "lab:tags":
        return tile(id, "Tags in draft", <TagsBody lab={lab} />);
      case "lab:curve":
        return tile(
          id,
          "Curve",
          <CurveBars
            tallies={curveTallies(lab.scope, lab.next, lab.lens)}
            events={lab.events}
            used={lab.used}
          />,
          true,
        );
      case "lab:heat":
        return tile(
          id,
          "Color × mana value",
          <Heat
            rows={heatRows(lab.scope, lab.next, lab.lens)}
            events={lab.events}
            used={lab.used}
          />,
          true,
        );
      case "lab:pt":
        return tile(
          id,
          "Power × toughness",
          <PtDots
            scope={lab.scope}
            next={lab.next}
            lens={lab.lens}
            events={lab.events}
            used={lab.used}
          />,
          true,
        );
      default:
        return isInsightsBlock(id)
          ? chartBlock(id, set, Tile, { ...controls(id), selectedCard: undefined })
          : null;
    }
  };
  return dock.order
    .filter((id) => !dock.hidden.has(id))
    .map((id) => {
      const spec = ALL_BLOCKS.find((block) => block.id === id);
      const height =
        spec?.h === undefined || dock.collapsed.has(id)
          ? undefined
          : Math.min(440, Math.max(220, spec.h * 18));
      return (
        <DockBlock
          key={id}
          id={id}
          dock={dock}
          dragging={dragging}
          setDragging={setDragging}
          height={height}
        >
          {body(id)}
        </DockBlock>
      );
    });
}
