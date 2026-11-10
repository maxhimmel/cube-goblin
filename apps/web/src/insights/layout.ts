import { useCallback, useState } from "react";
import { z } from "zod";

export const BLOCKS = [
  { id: "summary", span: 12, h: 4, minH: 3 },
  { id: "curve", span: 4, h: 11, minH: 6 },
  { id: "color", span: 4, h: 11, minH: 6 },
  { id: "heavy", span: 4, h: 11, minH: 6 },
  { id: "heat", span: 12, h: 12, minH: 7 },
  { id: "types", span: 4, h: 12, minH: 6 },
  { id: "functions", span: 4, h: 12, minH: 6 },
  { id: "status", span: 4, h: 8, minH: 5 },
  { id: "archetype", span: 4, h: 6, minH: 4 },
  { id: "group", span: 4, h: 6, minH: 4 },
] as const;

export type BlockId = (typeof BLOCKS)[number]["id"];

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
});

export type Layouts = Record<Breakpoint, Item[]>;

const BREAKPOINT_IDS = Object.keys(BREAKPOINTS) as Breakpoint[];

function packed(cols: number): Item[] {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return BLOCKS.map((block) => {
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

export function defaultLayouts(): Layouts {
  return {
    lg: packed(COLS.lg),
    md: packed(COLS.md),
    sm: packed(COLS.sm),
  };
}

function complete(items: readonly Item[], fallback: readonly Item[], cols: number): Item[] {
  const known = new Set<string>(BLOCKS.map((block) => block.id));
  const kept = items.filter((item) => known.has(item.i) && item.w <= cols);
  const ids = new Set(kept.map((item) => item.i));
  const bottom = Math.max(0, ...kept.map((item) => item.y + item.h));
  return [
    ...kept,
    ...fallback.filter((item) => !ids.has(item.i)).map((item) => ({ ...item, y: bottom + item.y })),
  ];
}

interface Stored {
  layouts: Layouts;
  collapsed: string[];
}

function load(): Stored {
  const defaults = defaultLayouts();
  try {
    const parsed = storedSchema.parse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
    const layouts = Object.fromEntries(
      BREAKPOINT_IDS.map((bp) => [bp, complete(parsed.layouts[bp] ?? [], defaults[bp], COLS[bp])]),
    ) as Layouts;
    return { layouts, collapsed: parsed.collapsed };
  } catch {
    return { layouts: defaults, collapsed: [] };
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
  layouts: Layouts;
  collapsed: ReadonlySet<string>;
  change: (next: Partial<Record<string, readonly Item[]>>) => void;
  toggle: (id: string) => void;
  reset: () => void;
}

export function useDashboard(): Dashboard {
  const [stored, setStored] = useState<Stored>(load);
  const collapsed = new Set(stored.collapsed);

  const commit = useCallback((next: Stored) => {
    setStored(next);
    save(next);
  }, []);

  const change = useCallback(
    (next: Partial<Record<string, readonly Item[]>>) => {
      const hidden = new Set(stored.collapsed);
      const layouts = Object.fromEntries(
        BREAKPOINT_IDS.map((bp) => {
          const previous = new Map(stored.layouts[bp].map((item) => [item.i, item]));
          const items = (next[bp] ?? stored.layouts[bp]).map((item) => {
            const before = previous.get(item.i);
            return strip(hidden.has(item.i) && before ? { ...item, h: before.h } : item);
          });
          return [bp, items];
        }),
      ) as Layouts;
      commit({ layouts, collapsed: stored.collapsed });
    },
    [commit, stored],
  );

  const toggle = useCallback(
    (id: string) => {
      const next = stored.collapsed.includes(id)
        ? stored.collapsed.filter((entry) => entry !== id)
        : [...stored.collapsed, id];
      commit({ layouts: stored.layouts, collapsed: next });
    },
    [commit, stored],
  );

  const reset = useCallback(() => {
    commit({ layouts: defaultLayouts(), collapsed: [] });
  }, [commit]);

  return { layouts: stored.layouts, collapsed, change, toggle, reset };
}

export function shown(dashboard: Dashboard): Layouts {
  const minH = new Map<string, number>(BLOCKS.map((block) => [block.id, block.minH]));
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
