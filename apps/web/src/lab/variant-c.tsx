import { mode } from "#mode";
import type { CardStatus } from "@repo/cube/browser";
import { cubeStats } from "@repo/cube/browser";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import { useState } from "react";
import { z } from "zod";
import { CardLink } from "../card-pane.tsx";
import type { Block } from "../insights/block.tsx";
import type { CardSet } from "../insights/filter-widgets.tsx";
import { chartBlock } from "../insights/insights-page.tsx";
import type { BlockId } from "../insights/layout.ts";
import { BLOCKS } from "../insights/layout.ts";
import { ManaCost } from "../mana.tsx";
import type { GridCard } from "../modes/mode.ts";
import { DRAG_TYPE, Preview, previewAt } from "../strip.tsx";
import { useRemembered } from "../view-choices.ts";
import { CurveBars, Heat, PtDots } from "./lab-charts.tsx";
import type { Lab } from "./lab-page.tsx";
import {
  AxisTabs,
  ColumnTitle,
  DraftCount,
  FilterList,
  PillBar,
  RowGroups,
  groups,
  stripeOf,
} from "./lab-page.tsx";
import { curveTallies, heatRows } from "./model.ts";
import { KEYWORDS, SYNTAX_NOTES, tryQuery } from "./query.ts";

const DOCKS = ["top", "right", "bottom", "left"] as const;
type Dock = (typeof DOCKS)[number];

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

function TagLine({ lab, card }: { lab: Lab; card: GridCard }): ReactNode {
  const tags = card.tags.map((id) => lab.vocabulary.find((tag) => tag.id === id)?.label ?? id);
  return (
    tags.length > 0 && (
      <span className="labc-strip-tags">
        {tags.map((tag) => (
          <span key={tag} className="lab-tag">
            {tag}
          </span>
        ))}
      </span>
    )
  );
}

function CStrip({ lab, card, tags }: { lab: Lab; card: GridCard; tags: boolean }): ReactNode {
  return (
    <li className="labc-cell" data-dim={lab.dimmed(card) ? "" : undefined}>
      <CardLink
        slug={card.slug}
        className="labc-strip"
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
        <span className="labc-strip-top">
          <span className="labc-strip-name">{card.name}</span>
          <ManaCost cost={card.manaCost} />
        </span>
        {tags && <TagLine lab={lab} card={card} />}
      </CardLink>
    </li>
  );
}

function CColumns({
  lab,
  cards,
  compact,
  tags,
}: {
  lab: Lab;
  cards: readonly GridCard[];
  compact: boolean;
  tags: boolean;
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
            <ul className="labc-stack">
              {column.cards.map((card) => (
                <CStrip key={card.slug} lab={lab} card={card} tags={tags} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Legend({ onClose }: { onClose: () => void }): ReactNode {
  return (
    <div className="labc-legend" role="dialog" aria-label="Query syntax">
      <header>
        <strong>Query syntax</strong>
        <button type="button" className="lab-link" onClick={onClose}>
          Close
        </button>
      </header>
      <table>
        <tbody>
          {KEYWORDS.map((keyword) => (
            <tr key={keyword.names[0]}>
              <td>
                <code>{keyword.names.join(" / ")}</code>
              </td>
              <td>{keyword.help}</td>
              <td>
                <code>{keyword.example}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table>
        <tbody>
          {SYNTAX_NOTES.map((note) => (
            <tr key={note.syntax}>
              <td>
                <code>{note.syntax}</code>
              </td>
              <td>{note.help}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">
        Try <code>t:creature pow&gt;=3 -c:g</code> or{" "}
        <code>(tag:removal or tag:burn) mv&lt;=2</code>
      </p>
    </div>
  );
}

function QueryBar({ lab }: { lab: Lab }): ReactNode {
  const [text, setText] = useState("");
  const [legend, setLegend] = useState(false);
  const parsed = text.trim() === "" ? undefined : tryQuery(text);
  const count = parsed?.test ? lab.scope.filter(parsed.test).length : undefined;
  return (
    <div className="labc-query">
      <PillBar lab={lab} />
      <form
        className="labc-query-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (parsed?.test) {
            lab.addPill(`x:${text.trim()}`);
            setText("");
          }
        }}
      >
        <input
          type="search"
          value={text}
          placeholder="Filter: t:creature pow>=3 …"
          aria-label="Filter query"
          aria-invalid={parsed?.error !== undefined}
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
        <button
          type="button"
          className="labc-help"
          aria-label="Query syntax"
          aria-expanded={legend}
          onClick={() => {
            setLegend(!legend);
          }}
        >
          ?
        </button>
        {parsed?.error !== undefined && <span className="labc-query-error">{parsed.error}</span>}
        {count !== undefined && (
          <span className="labc-query-count">{count} in draft · Enter to apply</span>
        )}
      </form>
      {legend && (
        <Legend
          onClose={() => {
            setLegend(false);
          }}
        />
      )}
    </div>
  );
}

function NewFilter({ lab, onDone }: { lab: Lab; onDone: () => void }): ReactNode {
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const parsed = query.trim() === "" ? undefined : tryQuery(query);
  const count = parsed?.test ? lab.scope.filter(parsed.test).length : undefined;
  return (
    <form
      className="labc-new-filter"
      onSubmit={(event) => {
        event.preventDefault();
        if (parsed?.test && label.trim() !== "") {
          lab.saveQuery({
            id: String(Date.now()),
            label: label.trim(),
            query: query.trim(),
          });
          onDone();
        }
      }}
    >
      <input
        value={label}
        placeholder="Name"
        aria-label="Filter name"
        onChange={(event) => {
          setLabel(event.target.value);
        }}
      />
      <input
        value={query}
        placeholder="Query, e.g. pow>=4 -t:dragon"
        aria-label="Filter query"
        aria-invalid={parsed?.error !== undefined}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <div className="labc-new-filter-foot">
        <span className={parsed?.error === undefined ? "muted" : "labc-query-error"}>
          {parsed?.error ?? (count === undefined ? "Type a query" : `${String(count)} in draft`)}
        </span>
        <button type="button" className="lab-link" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" disabled={!parsed?.test || label.trim() === ""}>
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
      <FilterList lab={lab} className="lab-a-filter-list" onRemove={lab.removeQuery} />
      {adding ? (
        <NewFilter
          lab={lab}
          onDone={() => {
            setAdding(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="labc-add"
          onClick={() => {
            setAdding(true);
          }}
        >
          + New filter
        </button>
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
    <div className="lab-b-chips labc-chips">
      {counts.map(({ tag, count }) => {
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
  );
}

interface DockState {
  order: string[];
  hidden: Set<string>;
  collapsed: Set<string>;
  move: (id: string, before: string) => void;
  setHidden: (id: string, hide: boolean) => void;
  toggle: (id: string) => void;
  reset: () => void;
}

function useDockState(): DockState {
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

function BlocksMenu({ dock }: { dock: DockState }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <div className="labc-menu">
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
        <div className="labc-menu-list">
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
      className="labc-block"
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

function SlimFrame({
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
    <section className="labc-tile" data-collapsed={collapsed ? "" : undefined} aria-label={title}>
      <header className="block-head labc-tile-head">
        <h2 title={typeof caption === "string" && !short ? caption : undefined}>{title}</h2>
        {short && !collapsed && <span className="labc-tile-caption">{caption}</span>}
        <span className="labc-tile-actions">
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
      {!collapsed && <div className="labc-tile-body">{asTable ? table : children}</div>}
    </section>
  );
}

function DockBlocks({ lab, dock }: { lab: Lab; dock: DockState }): ReactNode {
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
  const frame = (id: string, title: string, body: ReactNode, caption?: string): ReactNode => (
    <SlimFrame
      title={title}
      caption={caption}
      collapsed={dock.collapsed.has(id)}
      onToggle={() => {
        dock.toggle(id);
      }}
      onHide={() => {
        dock.setHidden(id, true);
      }}
    >
      {body}
    </SlimFrame>
  );
  const live = lab.lens !== undefined ? "filtered · baseline faint" : "draft";
  const body = (id: string): ReactNode => {
    switch (id) {
      case "lab:filters":
        return frame(id, "Filters", <FiltersBody lab={lab} />);
      case "lab:tags":
        return frame(id, "Tags in draft", <TagsBody lab={lab} />);
      case "lab:curve":
        return frame(
          id,
          "Curve",
          <CurveBars
            tallies={curveTallies(lab.scope, lab.next, lab.lens)}
            events={lab.events}
            used={lab.used}
          />,
          live,
        );
      case "lab:heat":
        return frame(
          id,
          "Color × mana value",
          <Heat
            rows={heatRows(lab.scope, lab.next, lab.lens)}
            events={lab.events}
            used={lab.used}
          />,
          live,
        );
      case "lab:pt":
        return frame(
          id,
          "Power × toughness",
          <PtDots
            scope={lab.scope}
            next={lab.next}
            lens={lab.lens}
            events={lab.events}
            used={lab.used}
          />,
          live,
        );
      default:
        return isInsightsBlock(id)
          ? chartBlock(id, set, SlimFrame, {
              collapsed: dock.collapsed.has(id),
              onToggle: () => {
                dock.toggle(id);
              },
              onHide: () => {
                dock.setHidden(id, true);
              },
              selectedCard: undefined,
            })
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

export function VariantC({ lab }: { lab: Lab }): ReactNode {
  const [dockAt, setDockAt] = useRemembered<Dock>("labc.dockAt", "top", z.enum(DOCKS));
  const [tags, setTags] = useRemembered("labc.stripTags", false, z.boolean());
  const [open, setOpen] = useRemembered("labc.dockOpen", true, z.boolean());
  const [view, setView] = useRemembered<"columns" | "rows">(
    "labc.view",
    "columns",
    z.enum(["columns", "rows"]),
  );
  const dock = useDockState();
  const draft = lab.cards.filter((card) => card.status === "draft");
  const prospects = lab.cards.filter((card) => card.status !== "draft");
  const zone = (status: CardStatus) => lab.zone(status);
  return (
    <div
      className="lab labc"
      data-dock={dockAt}
      data-dock-open={open ? "" : undefined}
      {...lab.dragRoot}
    >
      <header className="labc-top">
        <h1>Lab</h1>
        <DraftCount lab={lab} />
        <QueryBar lab={lab} />
        <div className="labc-controls">
          <div className="lab-b-seg" role="group" aria-label="Cards that don't match">
            <span className="labc-seg-label">Non-matches</span>
            {(
              [
                [false, "Dim"],
                [true, "Hide"],
              ] as const
            ).map(([hide, label]) => (
              <button
                key={label}
                type="button"
                className={lab.hide === hide ? "on" : undefined}
                aria-pressed={lab.hide === hide}
                onClick={() => {
                  lab.setHide(hide);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="lab-b-seg" role="group" aria-label="Charts dock">
            <span className="labc-seg-label">Charts</span>
            {DOCKS.map((id) => (
              <button
                key={id}
                type="button"
                className={dockAt === id ? "on" : undefined}
                aria-pressed={dockAt === id}
                aria-label={`Charts on the ${id}`}
                onClick={() => {
                  setDockAt(id);
                }}
              >
                {{ top: "↑", right: "→", bottom: "↓", left: "←" }[id]}
              </button>
            ))}
            <button
              type="button"
              className={open ? undefined : "on"}
              aria-pressed={!open}
              aria-label={open ? "Collapse charts" : "Show charts"}
              title={open ? "Collapse charts" : "Show charts"}
              onClick={() => {
                setOpen(!open);
              }}
            >
              {open ? "⊟" : "⊞"}
            </button>
          </div>
          <BlocksMenu dock={dock} />
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
            <label hidden={view === "rows"}>
              <input
                type="checkbox"
                checked={tags}
                onChange={(event) => {
                  setTags(event.target.checked);
                }}
              />
              Tags on cards
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
        </div>
      </header>
      <div className="labc-dock">
        {open ? (
          <DockBlocks lab={lab} dock={dock} />
        ) : (
          <button
            type="button"
            className="labc-dock-bar"
            onClick={() => {
              setOpen(true);
            }}
          >
            Charts · {dock.order.length - dock.hidden.size} blocks · show
          </button>
        )}
      </div>
      <div className="labc-floor">
        <section className="lab-a-draft" {...zone("draft")}>
          <header className="lab-a-floor-head">
            <h2>Draft</h2>
            <div className="labc-floor-tools">
              <div className="lab-b-seg" role="group" aria-label="Card layout">
                {(["columns", "rows"] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={view === id ? "on" : undefined}
                    aria-pressed={view === id}
                    onClick={() => {
                      setView(id);
                    }}
                  >
                    {id === "columns" ? "Columns" : "Rows"}
                  </button>
                ))}
              </div>
              <AxisTabs lab={lab} className="lab-b-seg" />
            </div>
          </header>
          {view === "columns" ? (
            <CColumns lab={lab} cards={draft} compact={false} tags={tags} />
          ) : (
            <RowGroups lab={lab} cards={draft} />
          )}
        </section>
        <section className="lab-a-prospects" {...zone("prospect")}>
          <header className="lab-a-floor-head">
            <h2>
              Prospects <span className="muted">{prospects.length}</span>
            </h2>
          </header>
          {view === "columns" ? (
            <CColumns lab={lab} cards={prospects} compact tags={tags} />
          ) : (
            <RowGroups lab={lab} cards={prospects} />
          )}
        </section>
      </div>
      <Preview hover={lab.hover} />
    </div>
  );
}
