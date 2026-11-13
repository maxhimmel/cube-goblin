import { useCallback, useState } from "react";
import { z } from "zod";

export interface BlockSpec {
  id: string;
  title: string;
  span: number;
  h: number;
  minH: number;
}

export const BLOCKS = [
  { id: "summary", title: "Summary", span: 12, h: 4, minH: 3 },
  { id: "curve", title: "Mana curve", span: 4, h: 11, minH: 6 },
  { id: "color", title: "Color", span: 4, h: 11, minH: 6 },
  { id: "heavy", title: "Heavy pips", span: 4, h: 11, minH: 6 },
  { id: "heat", title: "Color by mana value", span: 12, h: 12, minH: 7 },
  { id: "types", title: "Card types", span: 4, h: 12, minH: 6 },
  { id: "pt", title: "Power and toughness", span: 8, h: 12, minH: 7 },
  { id: "creature-balance", title: "Creature balance", span: 12, h: 26, minH: 8 },
  { id: "combat", title: "Combat matchups", span: 12, h: 20, minH: 10 },
  { id: "status", title: "Status", span: 4, h: 8, minH: 5 },
  { id: "tags", title: "Tags", span: 8, h: 26, minH: 8 },
] as const satisfies readonly BlockSpec[];

export type BlockId = (typeof BLOCKS)[number]["id"];

export const FILTER_BLOCK_PREFIX = "filter:";

export function filterBlockId(filterId: string): string {
  return `${FILTER_BLOCK_PREFIX}${filterId}`;
}

export function filterBlock(filterId: string, title: string): BlockSpec {
  return { id: filterBlockId(filterId), title, span: 4, h: 12, minH: 4 };
}

export const BREAKPOINTS = { lg: 1000, md: 620, sm: 0 } as const;
export const COLS = { lg: 12, md: 6, sm: 1 } as const;
export type Breakpoint = keyof typeof BREAKPOINTS;

export const ROW_HEIGHT = 24;
export const COLLAPSED_H = 2;
const STORAGE_KEY = "maxs-cube:insights-layout:v1";

const itemSchema = z.object({
  i: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export type Item = z.infer<typeof itemSchema> & { minW?: number; minH?: number };

const storedSchema = z.object({
  layouts: z.record(z.string(), z.array(itemSchema)),
  collapsed: z.array(z.string()),
  hidden: z.array(z.string()).default([]),
});

export type Layouts = Record<Breakpoint, Item[]>;

const BREAKPOINT_IDS = Object.keys(BREAKPOINTS) as Breakpoint[];

function packed(specs: readonly BlockSpec[], cols: number): Item[] {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return specs.map((block) => {
    const w = Math.max(1, Math.min(cols, Math.round((block.span * cols) / 12)));
    if (x + w > cols) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    const item = { i: block.id, x, y, w, h: block.h };
    x += w;
    rowHeight = Math.max(rowHeight, block.h);
    return item;
  });
}

function emptyLayouts(): Record<Breakpoint, Item[]> {
  return { lg: [], md: [], sm: [] };
}

function complete(items: readonly Item[], specs: readonly BlockSpec[], cols: number): Item[] {
  const known = new Set(specs.map((block) => block.id));
  const kept = items.filter((item) => known.has(item.i) && item.w <= cols);
  const ids = new Set(kept.map((item) => item.i));
  const bottom = Math.max(0, ...kept.map((item) => item.y + item.h));
  const missing = specs.filter((block) => !ids.has(block.id));
  return [...kept, ...packed(missing, cols).map((item) => ({ ...item, y: bottom + item.y }))];
}

interface Stored {
  layouts: Record<Breakpoint, Item[]>;
  collapsed: string[];
  hidden: string[];
}

function load(): Stored {
  try {
    const parsed = storedSchema.parse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
    const layouts = Object.fromEntries(
      BREAKPOINT_IDS.map((bp) => [bp, parsed.layouts[bp] ?? []]),
    ) as Layouts;
    return { layouts, collapsed: parsed.collapsed, hidden: parsed.hidden };
  } catch {
    return { layouts: emptyLayouts(), collapsed: [], hidden: [] };
  }
}

function save(stored: Stored): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    return;
  }
}

function strip(item: Item): Item {
  return { i: item.i, x: item.x, y: item.y, w: item.w, h: item.h };
}

export interface Dashboard {
  specs: readonly BlockSpec[];
  visible: readonly BlockSpec[];
  layouts: Layouts;
  collapsed: ReadonlySet<string>;
  hidden: ReadonlySet<string>;
  change: (next: Partial<Record<string, readonly Item[]>>) => void;
  toggle: (id: string) => void;
  setHidden: (id: string, hidden: boolean) => void;
  reset: () => void;
}

export function useDashboard(specs: readonly BlockSpec[]): Dashboard {
  const [stored, setStored] = useState<Stored>(load);
  const collapsed = new Set(stored.collapsed);
  const hidden = new Set(stored.hidden);
  const visible = specs.filter((block) => !hidden.has(block.id));
  const layouts = Object.fromEntries(
    BREAKPOINT_IDS.map((bp) => [bp, complete(stored.layouts[bp], visible, COLS[bp])]),
  ) as Layouts;

  const commit = useCallback((next: Stored) => {
    setStored(next);
    save(next);
  }, []);

  const change = useCallback(
    (next: Partial<Record<string, readonly Item[]>>) => {
      const shut = new Set(stored.collapsed);
      const merged = Object.fromEntries(
        BREAKPOINT_IDS.map((bp) => {
          const previous = new Map(stored.layouts[bp].map((item) => [item.i, item]));
          const incoming = next[bp];
          if (!incoming) {
            return [bp, stored.layouts[bp]];
          }
          const items = incoming.map((item) => {
            const before = previous.get(item.i);
            return strip(shut.has(item.i) && before ? { ...item, h: before.h } : item);
          });
          const placed = new Set(items.map((item) => item.i));
          const kept = stored.layouts[bp].filter((item) => !placed.has(item.i));
          return [bp, [...items, ...kept]];
        }),
      ) as Layouts;
      commit({ ...stored, layouts: merged });
    },
    [commit, stored],
  );

  const toggle = useCallback(
    (id: string) => {
      const next = stored.collapsed.includes(id)
        ? stored.collapsed.filter((entry) => entry !== id)
        : [...stored.collapsed, id];
      commit({ ...stored, collapsed: next });
    },
    [commit, stored],
  );

  const setHidden = useCallback(
    (id: string, hide: boolean) => {
      const rest = stored.hidden.filter((entry) => entry !== id);
      commit({ ...stored, hidden: hide ? [...rest, id] : rest });
    },
    [commit, stored],
  );

  const reset = useCallback(() => {
    commit({
      layouts: Object.fromEntries(
        BREAKPOINT_IDS.map((bp) => [bp, packed(BLOCKS, COLS[bp])]),
      ) as Layouts,
      collapsed: [],
      hidden: [],
    });
  }, [commit]);

  return { specs, visible, layouts, collapsed, hidden, change, toggle, setHidden, reset };
}

export function shown(dashboard: Dashboard): Layouts {
  const minH = new Map<string, number>(dashboard.specs.map((block) => [block.id, block.minH]));
  return Object.fromEntries(
    BREAKPOINT_IDS.map((bp) => [
      bp,
      dashboard.layouts[bp].map((item) =>
        dashboard.collapsed.has(item.i)
          ? { ...item, h: COLLAPSED_H, minH: COLLAPSED_H, maxH: COLLAPSED_H }
          : { ...item, minH: minH.get(item.i) ?? 2 },
      ),
    ]),
  ) as Layouts;
}
