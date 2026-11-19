import type { Tag } from "@repo/cube/browser";
import { COLORS, COLOR_GROUPS, CURVE_COLUMNS, TYPE_COLUMNS } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { colorIcon, curveTick } from "../insights/labels.tsx";

export interface StatRow {
  id: string;
  label: string;
  noun: string;
  section: string;
  icon?: ReactNode;
  iconOnly?: boolean;
}

export interface Section {
  key: string;
  title: string;
  blurb: string;
  rows: StatRow[];
}

export const CUSTOM = "custom";

export const FIXED_SECTIONS: Section[] = [
  {
    key: "curve",
    title: "Curve",
    blurb: "Share of each cube's cards at each mana value; lands sit out.",
    rows: CURVE_COLUMNS.map((column) => ({
      id: `curve:${column.id}`,
      label: `Mana value ${column.label}`,
      noun: `${column.label}-drops`,
      section: "Curve",
      icon: curveTick(column.id),
      iconOnly: true,
    })),
  },
  {
    key: "color",
    title: "Color",
    blurb: "Share of each cube's cards in each color; lands sit out.",
    rows: COLOR_GROUPS.map((group) => ({
      id: `color:${group.id}`,
      label: group.label,
      noun: group.label.toLowerCase(),
      section: "Color",
      icon: colorIcon(group.id),
    })),
  },
  {
    key: "types",
    title: "Card types",
    blurb: "A card counts under every type on its front face.",
    rows: TYPE_COLUMNS.map((column) => ({
      id: `type:${column.id}`,
      label: column.label,
      noun: `${column.label.toLowerCase()}s`,
      section: "Card types",
    })),
  },
  {
    key: "heavy",
    title: "Heavy pips",
    blurb: "Spells asking for two or more pips of one color.",
    rows: COLORS.map((color) => ({
      id: `heavy:${color.id}`,
      label: color.label,
      noun: `heavy ${color.label.toLowerCase()}`,
      section: "Heavy pips",
      icon: colorIcon(color.id),
    })),
  },
];

export function tagSection(tags: readonly Tag[]): Section {
  return {
    key: "tags",
    title: "Tags",
    blurb: "Tags match across cubes by name.",
    rows: tags.map((tag) => ({
      id: `tag:${tag.id}`,
      label: tag.label,
      noun: `“${tag.label}”`,
      section: "Tags",
    })),
  };
}
