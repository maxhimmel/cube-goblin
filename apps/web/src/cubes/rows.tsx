import type { Tag } from "@repo/cube/browser";
import { COLORS, COLOR_GROUPS, CURVE_COLUMNS, TYPE_COLUMNS } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { manaVar } from "../forge/lab-charts.tsx";
import { colorIcon } from "../insights/labels.tsx";
import { ManaSymbol } from "../mana.tsx";

export interface StatRow {
  id: string;
  label: string;
  noun: string;
  icon?: ReactNode;
  bar?: string | undefined;
}

export interface Matrix {
  title: string;
  blurb: string;
  rows: StatRow[];
}

const TYPE_ICON: Record<string, string> = {
  creature: "creature",
  planeswalker: "planeswalker",
  instant: "instant",
  sorcery: "sorcery",
  artifact: "artifact",
  enchantment: "enchantment",
  battle: "battle",
  land: "land",
};

function typeIcon(id: string): ReactNode {
  const name = TYPE_ICON[id];
  return name === undefined ? null : <i className={`ms ms-${name}`} aria-hidden="true" />;
}

function curveIcon(id: string, label: string): ReactNode {
  const plus = label.endsWith("+");
  return (
    <span className="cubes-mv" aria-hidden="true">
      <ManaSymbol symbol={id} label="" />
      {plus && "+"}
    </span>
  );
}

export const SHAPE_ROWS: StatRow[] = [
  { id: "type:creature", label: "Creatures", noun: "creatures", icon: typeIcon("creature") },
  { id: "type:land", label: "Lands", noun: "lands", icon: typeIcon("land") },
];

export const FIXED_MATRICES: Matrix[] = [
  {
    title: "Curve",
    blurb: "Share of each cube's cards at each mana value; lands sit out.",
    rows: CURVE_COLUMNS.map((column) => ({
      id: `curve:${column.id}`,
      label: `MV ${column.label}`,
      noun: `${column.label}-drops`,
      icon: curveIcon(column.id, column.label),
    })),
  },
  {
    title: "Color",
    blurb: "Share of each cube's cards in each color; lands sit out.",
    rows: COLOR_GROUPS.map((group) => ({
      id: `color:${group.id}`,
      label: group.label,
      noun: group.label.toLowerCase(),
      icon: colorIcon(group.id),
      bar: manaVar(group.id),
    })),
  },
  {
    title: "Card types",
    blurb: "A card counts under every type on its front face.",
    rows: TYPE_COLUMNS.map((column) => ({
      id: `type:${column.id}`,
      label: column.label,
      noun: `${column.label.toLowerCase()}s`,
      icon: typeIcon(column.id),
    })),
  },
  {
    title: "Heavy pips",
    blurb: "Spells asking for two or more pips of one color.",
    rows: COLORS.map((color) => ({
      id: `heavy:${color.id}`,
      label: color.label,
      noun: `heavy ${color.label.toLowerCase()}`,
      icon: (
        <span className="cubes-pips" aria-hidden="true">
          {colorIcon(color.id)}
          {colorIcon(color.id)}
        </span>
      ),
      bar: manaVar(color.id),
    })),
  },
];

export function tagMatrix(tags: readonly Tag[]): Matrix {
  return {
    title: "Tags",
    blurb: "Tags match across cubes by name.",
    rows: tags.map((tag) => ({
      id: `tag:${tag.id}`,
      label: tag.label,
      noun: tag.label.toLowerCase(),
      icon: <span className="cubes-hash">#</span>,
    })),
  };
}
