import { COLORS, PRESENCE_GROUPS, TYPE_COLUMNS, compileQuery, isLand } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { z } from "zod";
import type { Block } from "../insights/block.tsx";
import { QueryInput } from "../query/query-input.tsx";
import { useRemembered } from "../view-choices.ts";
import { colorIcon } from "../insights/labels.tsx";
import {
  BalanceStrips,
  BarList,
  CombatPlot,
  CurveBars,
  Heat,
  PtDots,
  SummaryTiles,
  TagChips,
  manaVar,
} from "./lab-charts.tsx";
import type { Tally } from "./model.ts";
import {
  balanceRows,
  bucketTallies,
  curveTallies,
  heatRows,
  matchups,
  resolvePill,
  tally,
} from "./model.ts";
import type { BlockView, Lab, Pin } from "./use-lab.ts";
import { PINS } from "./use-lab.ts";

export const DOCKS = ["top", "right", "bottom", "left"] as const;
export type Dock = (typeof DOCKS)[number];

const BLOCK_DRAG = "application/x-lab-block";

const LAB_BLOCKS = [
  { id: "lab:summary", title: "Summary" },
  { id: "lab:filters", title: "Filters" },
  { id: "lab:curve", title: "Curve" },
  { id: "lab:color", title: "Color" },
  { id: "lab:heat", title: "Color × mana value" },
  { id: "lab:pt", title: "Power × toughness" },
  { id: "lab:balance", title: "Creature balance" },
  { id: "lab:combat", title: "Combat matchups" },
  { id: "lab:types", title: "Card types" },
  { id: "lab:heavy", title: "Heavy pips" },
  { id: "lab:archetypes", title: "Archetypes" },
  { id: "lab:groups", title: "Groups" },
] as const;

const COLOR_ROWS = [
  ...PRESENCE_GROUPS.map((group) => ({ id: `presence:${group.id}`, label: group.label })),
  { id: "color:colorless", label: "Colorless" },
];

const HEAVY_ROWS = COLORS.map((color) => ({ id: `heavy:${color.id}`, label: color.label }));

const TYPE_ROWS = TYPE_COLUMNS.map((column) => ({ id: `type:${column.id}`, label: column.label }));

function summaryTallies(view: BlockView): Tally[] {
  const row = (id: string, label: string, inside: (card: BlockView["scope"][number]) => boolean) =>
    tally(id, label, view.scope, view.next, inside, view.lens);
  return [
    row("cards", "Cards", () => true),
    row("nonland", "Nonland", (card) => !isLand(card)),
    ...bucketTallies(
      [
        { id: "type:land", label: "Lands" },
        { id: "type:creature", label: "Creatures" },
      ],
      view.scope,
      view.next,
      view.lens,
    ),
  ];
}

const RENAMED: Partial<Record<string, string>> = {
  "lab:tags": "lab:groups",
  summary: "lab:summary",
  color: "lab:color",
  heavy: "lab:heavy",
  types: "lab:types",
  groups: "lab:groups",
  archetypes: "lab:archetypes",
  "creature-balance": "lab:balance",
  combat: "lab:combat",
};

const ALL_BLOCKS: readonly { id: string; title: string }[] = LAB_BLOCKS;

const DEFAULT_ORDER = ALL_BLOCKS.map((block) => block.id);

const DEFAULT_HIDDEN: string[] = [];

const TAG_BLOCKS = new Set<string>(["lab:archetypes", "lab:groups"]);

const CHARTS = new Set<string>(
  LAB_BLOCKS.map((block) => block.id).filter((id) => id !== "lab:filters"),
);

function renameKeys<T>(record: Partial<Record<string, T>>): Partial<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [RENAMED[key] ?? key, value]),
  );
}

function migrate(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => RENAMED[id] ?? id))];
}

const pinSchema = z.enum(["filter", "draft", "considered", "all"]);

const TileExtras = createContext<ReactNode>(null);

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

export interface DockState {
  order: string[];
  hidden: Set<string>;
  collapsed: Set<string>;
  pins: Partial<Record<string, Pin>>;
  baselines: Partial<Record<string, boolean>>;
  chips: Set<string>;
  setChips: (id: string, on: boolean) => void;
  setPin: (id: string, pin: Pin) => void;
  setBaseline: (id: string, on: boolean | undefined) => void;
  move: (id: string, before: string) => void;
  setHidden: (id: string, hide: boolean) => void;
  toggle: (id: string) => void;
  reset: () => void;
}

export function useDockState(): DockState {
  const ids = z.array(z.string());
  const [order, setOrder] = useRemembered("labc.order", DEFAULT_ORDER, ids);
  const [storedHidden, setHidden] = useRemembered("labc.hidden", DEFAULT_HIDDEN, ids);
  const [storedCollapsed, setCollapsed] = useRemembered<string[]>("labc.collapsed", [], ids);
  const [storedPins, setPins] = useRemembered<Partial<Record<string, Pin>>>(
    "lab.pins",
    {},
    z.partialRecord(z.string(), pinSchema),
  );
  const [storedBaselines, setBaselines] = useRemembered<Partial<Record<string, boolean>>>(
    "lab.baselines",
    {},
    z.partialRecord(z.string(), z.boolean()),
  );
  const [storedChips, setStoredChips] = useRemembered<string[]>("lab.chips", [], ids);
  const pins = renameKeys(storedPins);
  const baselines = renameKeys(storedBaselines);
  const hidden = migrate(storedHidden);
  const collapsed = migrate(storedCollapsed);
  const known = [
    ...migrate(order).filter((id) => ALL_BLOCKS.some((block) => block.id === id)),
    ...ALL_BLOCKS.map((block) => block.id).filter((id) => !migrate(order).includes(id)),
  ];
  return {
    order: known,
    hidden: new Set(hidden),
    collapsed: new Set(collapsed),
    pins,
    baselines,
    chips: new Set(storedChips),
    setChips: (id, on) => {
      setStoredChips(
        on
          ? [...storedChips.filter((other) => other !== id), id]
          : storedChips.filter((other) => other !== id),
      );
    },
    setPin: (id, pin) => {
      setPins({ ...pins, [id]: pin });
    },
    setBaseline: (id, on) => {
      const rest = Object.fromEntries(Object.entries(baselines).filter(([key]) => key !== id));
      setBaselines(on === undefined ? rest : { ...rest, [id]: on });
    },
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
      setPins({});
      setBaselines({});
      setStoredChips([]);
    },
  };
}

export function BlocksMenu({ dock }: { dock: DockState }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="lab-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }}
    >
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
}: {
  id: string;
  dock: DockState;
  dragging: string | undefined;
  setDragging: (id: string | undefined) => void;
  children: ReactNode;
}): ReactNode {
  const [grab, setGrab] = useState(false);
  const [over, setOver] = useState(false);
  return (
    <div
      className="lab-block"
      data-block={id}
      data-dragging={dragging === id ? "" : undefined}
      data-over={over && dragging !== id ? "" : undefined}
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

export function CollapseButton({
  title,
  collapsed,
  onToggle,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
      onClick={onToggle}
    >
      {collapsed ? "+" : "–"}
    </button>
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
  const [asTable, setAsTable] = useRemembered(`table.lab.${title}`, false, z.boolean());
  const extras = useContext(TileExtras);
  const short = typeof caption === "string" && caption.length <= SHORT_CAPTION;
  return (
    <section className="lab-tile" data-collapsed={collapsed ? "" : undefined} aria-label={title}>
      <header className="block-head lab-tile-head">
        <h2 title={typeof caption === "string" && !short ? caption : undefined}>{title}</h2>
        {short && !collapsed && <span className="lab-tile-caption">{caption}</span>}
        <span className="lab-tile-actions">
          {!collapsed && actions}
          {!collapsed && extras}
          {table !== undefined && !collapsed && (
            <button
              type="button"
              aria-pressed={asTable}
              aria-label="Table"
              title="Table"
              onClick={() => {
                setAsTable(!asTable);
              }}
            >
              ▤
            </button>
          )}
          <CollapseButton title={title} collapsed={collapsed} onToggle={onToggle} />
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

function BlockControls({
  id,
  title,
  dock,
  global,
}: {
  id: string;
  title: string;
  dock: DockState;
  global: boolean;
}): ReactNode {
  const pin = dock.pins[id] ?? "filter";
  const override = dock.baselines[id];
  const on = override ?? global;
  return (
    <>
      <select
        aria-label={`Scope of ${title}`}
        title="Follow the filter, or pin to a scope"
        value={pin}
        onChange={(event) => {
          dock.setPin(id, pinSchema.parse(event.target.value));
        }}
      >
        {PINS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {TAG_BLOCKS.has(id) && (
        <button
          type="button"
          aria-pressed={dock.chips.has(id)}
          aria-label={`Show ${title} as chips`}
          title={dock.chips.has(id) ? "Show as bars" : "Show as chips"}
          onClick={() => {
            dock.setChips(id, !dock.chips.has(id));
          }}
        >
          ◫
        </button>
      )}
      {CHARTS.has(id) && pin === "filter" && (
        <button
          type="button"
          aria-pressed={on}
          aria-label={`Baseline for ${title}`}
          title={
            override === undefined
              ? "Baseline follows the global switch"
              : "Baseline set for this block; click again to follow the global switch"
          }
          data-override={override === undefined ? undefined : ""}
          onClick={() => {
            dock.setBaseline(id, override === undefined ? !global : undefined);
          }}
        >
          ◐
        </button>
      )}
    </>
  );
}

export function DockBlocks({ lab, dock }: { lab: Lab; dock: DockState }): ReactNode {
  const [dragging, setDragging] = useState<string | undefined>(undefined);
  const controls = (id: string) => ({
    collapsed: dock.collapsed.has(id),
    onToggle: () => {
      dock.toggle(id);
    },
    onHide: () => {
      dock.setHidden(id, true);
    },
  });
  const body = (id: string): ReactNode => {
    const pin = dock.pins[id] ?? "filter";
    const view = lab.view(pin, dock.baselines[id] ?? lab.baseline);
    const label = PINS.find((option) => option.id === pin)?.label ?? pin;
    const caption =
      pin !== "filter" ? label : view.lens !== undefined ? "filtered · baseline faint" : "draft";
    const tile = (title: string, chart: ReactNode, live?: boolean): ReactNode => (
      <Tile title={title} caption={live ? caption : undefined} {...controls(id)}>
        {chart}
      </Tile>
    );
    switch (id) {
      case "lab:filters":
        return tile("Filters", <FiltersBody lab={lab} />);
      case "lab:summary":
        return tile(
          "Summary",
          <SummaryTiles tallies={summaryTallies(view)} events={view.events} />,
          true,
        );
      case "lab:color":
        return tile(
          "Color",
          <BarList
            name="Color"
            tallies={bucketTallies(COLOR_ROWS, view.scope, view.next, view.lens)}
            events={view.events}
            swatch={manaVar}
            icon={colorIcon}
          />,
          true,
        );
      case "lab:heavy":
        return tile(
          "Heavy pips",
          <BarList
            name="Heavy pips"
            tallies={bucketTallies(HEAVY_ROWS, view.scope, view.next, view.lens)}
            events={view.events}
            swatch={manaVar}
            icon={colorIcon}
          />,
          true,
        );
      case "lab:types":
        return tile(
          "Card types",
          <BarList
            name="Card types"
            tallies={bucketTallies(TYPE_ROWS, view.scope, view.next, view.lens)}
            events={view.events}
          />,
          true,
        );
      case "lab:archetypes":
      case "lab:groups": {
        const kind = id === "lab:archetypes" ? "archetype" : "group";
        const title = id === "lab:archetypes" ? "Archetypes" : "Groups";
        const rows = lab.vocabulary
          .filter((tag) => tag.kind === kind)
          .map((tag) => ({ id: `tag:${tag.id}`, label: tag.label }));
        const tallies = bucketTallies(rows, view.scope, view.next, view.lens).toSorted(
          (a, b) => b.base - a.base || a.label.localeCompare(b.label),
        );
        return tile(
          title,
          dock.chips.has(id) ? (
            <TagChips name={title} tallies={tallies} events={view.events} />
          ) : (
            <BarList name={title} tallies={tallies} events={view.events} />
          ),
          true,
        );
      }
      case "lab:curve":
        return tile(
          "Curve",
          <CurveBars
            tallies={curveTallies(view.scope, view.next, view.lens)}
            events={view.events}
            used={view.used}
          />,
          true,
        );
      case "lab:heat":
        return tile(
          "Color × mana value",
          <Heat
            rows={heatRows(view.scope, view.next, view.lens)}
            events={view.events}
            used={view.used}
          />,
          true,
        );
      case "lab:pt":
        return tile(
          "Power × toughness",
          <PtDots
            scope={view.scope}
            next={view.next}
            lens={view.lens}
            events={view.events}
            used={view.used}
          />,
          true,
        );
      case "lab:balance":
        return tile(
          "Creature balance",
          <BalanceStrips
            rows={balanceRows(view.scope, view.next, view.lens)}
            events={view.events}
          />,
          true,
        );
      case "lab:combat":
        return tile(
          "Combat matchups",
          <CombatPlot data={matchups(view.scope, view.next, view.lens)} events={view.events} />,
          true,
        );
      default:
        return null;
    }
  };
  return dock.order
    .filter((id) => !dock.hidden.has(id))
    .map((id) => {
      const spec = ALL_BLOCKS.find((block) => block.id === id);
      const scoped = id !== "lab:filters" && id !== "lab:tags";
      return (
        <DockBlock key={id} id={id} dock={dock} dragging={dragging} setDragging={setDragging}>
          <TileExtras.Provider
            value={
              scoped && (
                <BlockControls
                  id={id}
                  title={spec?.title ?? id}
                  dock={dock}
                  global={lab.baseline}
                />
              )
            }
          >
            {body(id)}
          </TileExtras.Provider>
        </DockBlock>
      );
    });
}
