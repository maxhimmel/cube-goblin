import { mode } from "#mode";
import type { CardStatus, ColumnAxis, Filter, Tag } from "@repo/cube/browser";
import { COLUMN_AXES, newFilterId } from "@repo/cube/browser";
import type { DragEvent } from "react";
import { useState } from "react";
import { z } from "zod";
import type { GridCard } from "../modes/mode.ts";
import type { Hover } from "../strip.tsx";
import { DRAG_TYPE } from "../strip.tsx";
import { useRemembered } from "../view-choices.ts";
import type { ChartEvents } from "./lab-charts.tsx";
import type { Drag, Pill, Test, Used } from "./model.ts";
import { allOf, project, resolvePill, stackQuery, usedIn } from "./model.ts";

export type Axis = ColumnAxis | "none";

export const AXES: { id: Axis; label: string }[] = [...COLUMN_AXES, { id: "none", label: "None" }];

function flip(status: CardStatus): CardStatus {
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
  saveFilter: ((label: string, query: string) => string) | undefined;
  deleteFilter: ((id: string) => void) | undefined;
  addPill: (key: string) => void;
  replacePill: (from: string, to: string) => void;
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
  drag: Drag | undefined;
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
  const [typing, setTyping] = useState("");
  const [drag, setDrag] = useState<Drag | undefined>(undefined);
  const [hover, setHover] = useState<Hover | undefined>(undefined);
  if (!cube) {
    return undefined;
  }
  const all = cube.cards;
  const cards = all.filter((card) => showCut || card.status !== "cut");
  const pills = pillKeys.flatMap((key) => resolvePill(key, filters) ?? []);
  const peekPill =
    peek !== undefined
      ? resolvePill(peek, filters)
      : typing === ""
        ? undefined
        : resolvePill(`x:${typing}`, filters);
  const applied = allOf(pills.map((pill) => pill.test));
  const lens = allOf([...pills, ...(peekPill ? [peekPill] : [])].map((pill) => pill.test));
  const hoverSlug = hover?.card.slug;
  const hovered = hoverSlug === undefined ? undefined : all.find((c) => c.slug === hoverSlug);
  const ghost: Drag | undefined =
    drag ?? (hovered ? { slug: hovered.slug, to: flip(hovered.status) } : undefined);
  const projected = project(all, ghost);
  const scope = all.filter(PIN_INCLUDES.draft);
  const next = projected.filter(PIN_INCLUDES.draft);
  const pick = (key: string): void => {
    togglePill(key);
    setPeek(undefined);
  };
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
    replacePill: (from, to) => {
      setPillKeys(pillKeys.map((key) => (key === from ? to : key)));
    },
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
          const id = newFilterId(filters);
          const keys = pills.map((pill) => pill.key);
          mode.putFilter?.({ id, label, query: stackQuery(keys, filters), view: "cards" });
          setPillKeys([`f:${id}`]);
        }
      : undefined,
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
    scope,
    next,
    events: { onPeek: setPeek, onPick: pick, baseline, filtered: lens !== undefined },
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
        events: { onPeek: setPeek, onPick: pick, baseline: on, filtered: blockLens !== undefined },
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
