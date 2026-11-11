import { mode } from "#mode";
import type { CardSort, CardStatus, ColumnAxis, Filter, Tag } from "@repo/cube/browser";
import { COLUMN_AXES, isCardSort, newFilterId } from "@repo/cube/browser";
import { useSearch } from "@tanstack/react-router";
import type { DragEvent } from "react";
import { useState } from "react";
import { z } from "zod";
import type { GridCard } from "../modes/mode.ts";
import type { Hover } from "../strip.tsx";
import { DRAG_TYPE } from "../strip.tsx";
import { recallState, useRemembered } from "../view-choices.ts";
import type { ChartEvents } from "./lab-charts.tsx";
import type { Drag, Pill, Test, Used } from "./model.ts";
import {
  allOf,
  peekKeys,
  pickKeys,
  pillMembers,
  project,
  resolvePill,
  stackQuery,
  usedIn,
} from "./model.ts";

export type Axis = ColumnAxis | "none";

export const AXES: { id: Axis; label: string }[] = [...COLUMN_AXES, { id: "none", label: "None" }];

const DEFAULT_SORTS: Record<Axis, CardSort[]> = {
  mv: ["color"],
  color: ["mv"],
  type: ["mv", "color"],
  none: ["mv", "color"],
};

type Pile = "draft" | "prospect";

function flip(status: CardStatus): Pile {
  return status === "draft" ? "prospect" : "draft";
}

export const PINS = [
  { id: "filter", label: "Follows filter" },
  { id: "draft", label: "Draft" },
  { id: "considered", label: "Draft + prospects" },
  { id: "all", label: "All cards" },
] as const;

export type Pin = (typeof PINS)[number]["id"];

const PIN_INCLUDES: Record<Pin, (card: GridCard) => boolean> = {
  filter: (card) => card.status === "draft",
  draft: (card) => card.status === "draft",
  considered: (card) => card.status !== "cut",
  all: () => true,
};

export interface PendingMove {
  card: GridCard;
  to: Pile;
}

export type PendingMark = "add" | "cut";

const pendingSchema = z.array(z.object({ slug: z.string(), to: z.enum(["draft", "prospect"]) }));

function markOf(to: CardStatus): PendingMark {
  return to === "draft" ? "add" : "cut";
}

export interface BlockView {
  scope: GridCard[];
  next: GridCard[];
  lens: Test | undefined;
  used: Used;
  events: ChartEvents;
}

export interface Lab {
  cards: GridCard[];
  vocabulary: Tag[];
  filters: Filter[];
  saveFilter: ((label: string, query: string, replaces?: readonly string[]) => void) | undefined;
  deleteFilter: ((id: string) => void) | undefined;
  addPill: (key: string) => void;
  typing: string;
  setTyping: (query: string) => void;
  used: Used;
  size: { min: number; max: number } | undefined;
  pills: Pill[];
  togglePill: (key: string) => void;
  clearPills: () => void;
  saveStack: ((label: string) => void) | undefined;
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
  sort: CardSort[];
  setSort: (keys: CardSort[]) => void;
  drag: Drag | undefined;
  selected: string | undefined;
  scope: GridCard[];
  next: GridCard[];
  events: ChartEvents;
  view: (pin: Pin, baseline: boolean) => BlockView;
  hover: Hover | undefined;
  onHover: (hover: Hover | undefined) => void;
  zone: (status: CardStatus) => {
    "data-zone": string;
    "data-over": string | undefined;
    onDragOver: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
  pending: PendingMove[];
  pendingOf: (card: GridCard) => PendingMark | undefined;
  queue: (card: GridCard) => void;
  unqueue: (slug: string) => void;
  clearPending: () => void;
  applyPending: (() => void) | undefined;
  pendingZone: {
    "data-over": string | undefined;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: () => void;
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
  const [sorts, setSorts] = useRemembered<Partial<Record<Axis, CardSort[]>>>(
    "lab.sorts",
    {},
    z.partialRecord(
      z.enum(["mv", "color", "type", "none"]),
      z.array(z.string()).transform((keys) => keys.filter(isCardSort)),
    ),
  );
  const sort = sorts[axis] ?? DEFAULT_SORTS[axis];
  const setSort = (keys: CardSort[]): void => {
    setSorts({ ...sorts, [axis]: keys });
  };
  const [storedPending, setStoredPending] = useRemembered("pending.lab", [], pendingSchema);
  const [overPending, setOverPending] = useState(false);
  const [peek, setPeek] = useState<string | undefined>(undefined);
  const [typing, setTyping] = useState("");
  const [drag, setDrag] = useState<Drag | undefined>(undefined);
  const [hover, setHover] = useState<Hover | undefined>(undefined);
  const { card: selected } = useSearch({ from: "__root__" });
  if (!cube) {
    return undefined;
  }
  const all = cube.cards;
  const cards = all.filter((card) => showCut || card.status !== "cut");
  const resolve = (keys: readonly string[]) =>
    keys.flatMap((key) => resolvePill(key, filters) ?? []);
  const pills = resolve(pillKeys);
  const lensKeys =
    peek !== undefined
      ? peekKeys(pillKeys, peek)
      : typing === ""
        ? pillKeys
        : [...pillKeys, `x:${typing}`];
  const peeking = peek !== undefined || typing !== "";
  const applied = allOf(pills.map((pill) => pill.test));
  const lens = allOf(resolve(lensKeys).map((pill) => pill.test));
  const picked = new Set(pillKeys.flatMap(pillMembers));
  const pending: PendingMove[] = storedPending.flatMap((entry) => {
    const card = all.find((candidate) => candidate.slug === entry.slug);
    return card && card.status !== "cut" && card.status !== entry.to
      ? [{ card, to: entry.to }]
      : [];
  });
  const pendingTo = new Map(pending.map((entry) => [entry.card.slug, entry.to]));
  const queued = project(
    all,
    pending.map((entry) => ({ slug: entry.card.slug, to: entry.to })),
  );
  const statusOf = (slug: string): CardStatus | undefined =>
    queued.find((card) => card.slug === slug)?.status;
  const setPending = (next: readonly PendingMove[]): void => {
    setStoredPending(next.map((entry) => ({ slug: entry.card.slug, to: entry.to })));
  };
  const queue = (card: GridCard): void => {
    if (card.status === "cut") {
      return;
    }
    setPending(
      pendingTo.has(card.slug)
        ? pending.filter((entry) => entry.card.slug !== card.slug)
        : [...pending, { card, to: flip(card.status) }],
    );
  };
  const hoverSlug = hover?.card.slug;
  const hovered = hoverSlug === undefined ? undefined : all.find((c) => c.slug === hoverSlug);
  const opened = selected === undefined ? undefined : all.find((c) => c.slug === selected);
  const flipNow = (card: GridCard): Drag => ({
    slug: card.slug,
    to: flip(statusOf(card.slug) ?? card.status),
  });
  const moves: Drag[] = [
    ...pending.map((entry) => ({ slug: entry.card.slug, to: entry.to })),
    ...(opened ? [flipNow(opened)] : []),
    ...(drag ? [drag] : hovered ? [flipNow(hovered)] : []),
  ];
  const projected = project(all, moves);
  const scope = all.filter(PIN_INCLUDES.draft);
  const next = projected.filter(PIN_INCLUDES.draft);
  const pick = (key: string): void => {
    setPillKeys(pickKeys(pillKeys, key));
    setPeek(undefined);
  };
  const togglePill = (key: string): void => {
    setPillKeys(
      pillKeys.includes(key) ? pillKeys.filter((other) => other !== key) : [...pillKeys, key],
    );
  };
  const saveFilter = (label: string, query: string, replaces: readonly string[] = []): void => {
    const id = newFilterId(filters);
    void mode.putFilter?.({ id, label, query, view: "cards" }).then((saved) => {
      if (saved && replaces.length > 0) {
        const current = recallState("lab.pills", z.array(z.string())) ?? [];
        const kept = current.filter((key) => !replaces.includes(key));
        const at = current.findIndex((key) => replaces.includes(key));
        setPillKeys([...kept.slice(0, Math.max(at, 0)), `f:${id}`, ...kept.slice(Math.max(at, 0))]);
      }
    });
  };
  const move = mode.moveCard;
  return {
    cards,
    vocabulary: cube.vocabulary,
    filters,
    saveFilter: mode.putFilter ? saveFilter : undefined,
    deleteFilter: mode.deleteFilter
      ? (id) => {
          mode.deleteFilter?.(id);
          setPillKeys(pillKeys.filter((key) => key !== `f:${id}`));
        }
      : undefined,
    typing,
    setTyping,
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
    saveStack: mode.putFilter
      ? (label) => {
          const keys = pills.map((pill) => pill.key);
          saveFilter(label, stackQuery(keys, filters), keys);
        }
      : undefined,
    setPeek,
    lens,
    dimmed: (card) =>
      peeking
        ? lens !== undefined && !lens(card)
        : !hide && applied !== undefined && !applied(card),
    hidden: (card) => hide && !peeking && applied !== undefined && !applied(card),
    baseline,
    setBaseline,
    hide,
    setHide,
    showCut,
    setShowCut,
    axis,
    setAxis,
    sort,
    setSort,
    drag,
    selected,
    scope,
    next,
    events: { onPeek: setPeek, onPick: pick, baseline, filtered: lens !== undefined, picked },
    view: (pin, on) => {
      const follows = pin === "filter";
      const blockScope = follows ? scope : all.filter(PIN_INCLUDES[pin]);
      const blockNext = follows ? next : projected.filter(PIN_INCLUDES[pin]);
      const blockLens = follows ? lens : undefined;
      return {
        scope: blockScope,
        next: blockNext,
        lens: blockLens,
        used: usedIn([...blockScope, ...blockNext]),
        events: {
          onPeek: setPeek,
          onPick: pick,
          baseline: on,
          filtered: blockLens !== undefined,
          picked,
        },
      };
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
    pending,
    pendingOf: (card) => {
      const to = pendingTo.get(card.slug);
      return to === undefined ? undefined : markOf(to);
    },
    queue,
    unqueue: (slug) => {
      setPending(pending.filter((entry) => entry.card.slug !== slug));
    },
    clearPending: () => {
      setPending([]);
    },
    applyPending:
      mode.moveCards && pending.length > 0
        ? () => {
            const adds = pending.filter((entry) => entry.to === "draft").length;
            const cuts = pending.length - adds;
            mode.moveCards?.(
              pending.map((entry) => ({ card: entry.card, status: entry.to })),
              `pending: +${String(adds)} −${String(cuts)}`,
            );
            setPending([]);
          }
        : undefined,
    pendingZone: {
      "data-over": overPending ? "" : undefined,
      onDragOver: (event) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE) || !drag) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setOverPending(true);
        const card = all.find((candidate) => candidate.slug === drag.slug);
        const to = card && !pendingTo.has(card.slug) ? flip(card.status) : undefined;
        if (drag.to !== to) {
          setDrag({ slug: drag.slug, to });
        }
      },
      onDragLeave: () => {
        setOverPending(false);
      },
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        setOverPending(false);
        const card = all.find((candidate) => candidate.slug === drag?.slug);
        if (card && !pendingTo.has(card.slug)) {
          queue(card);
        }
        setDrag(undefined);
      },
    },
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
        setOverPending(false);
      },
    },
  };
}
