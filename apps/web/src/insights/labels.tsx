import type { Bucket, BucketKind, Count, CubeStats } from "@repo/cube/browser";
import { COLOR_GROUPS, CURVE_COLUMNS, HEAVY_PIPS, PT_VALUES } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { ManaSymbol, MulticolorSymbol } from "../mana.tsx";
import type { TickLabel } from "./charts.tsx";

const COLOR_SYMBOLS: Record<string, string> = { multicolored: "multicolor", colorless: "C" };

export function colorIcon(id: string): ReactNode {
  const symbol = COLOR_SYMBOLS[id] ?? id;
  return symbol === "multicolor" ? (
    <MulticolorSymbol />
  ) : (
    <i className={`ms ms-${symbol.toLowerCase()} ms-cost`} aria-hidden="true" />
  );
}

export function colorLabel(id: string): string {
  return COLOR_GROUPS.find((group) => group.id === id)?.label ?? id;
}

export function ptLabel(id: string): string {
  return PT_VALUES.find((value) => value.id === id)?.label ?? id;
}

export const ptTick: TickLabel = (id) => ptLabel(id);

export function curveLabel(id: string): string {
  return CURVE_COLUMNS.find((column) => column.id === id)?.label ?? id;
}

export const colorTick: TickLabel = (id) => (
  <>
    {colorIcon(id)} {colorLabel(id)}
  </>
);

export const curveTick: TickLabel = (id) => {
  const label = curveLabel(id);
  return (
    <>
      <ManaSymbol symbol={id} label={label} />
      {label.endsWith("+") && <span aria-hidden="true">+</span>}
    </>
  );
};

export const KIND_TITLES: Record<BucketKind, string> = {
  curve: "Mana curve",
  color: "Color",
  colorCurve: "Color by mana value",
  presence: "Color",
  colorMulti: "Color",
  heavy: "Heavy pips",
  type: "Card types",
  pt: "Power and toughness",
  body: "Combat matchups",
  creatureCurve: "Creature balance",
  status: "Status",
  tag: "Tags",
};

export function bucketLabel(bucket: Bucket, stats: CubeStats): string {
  const [first = "", second = ""] = bucket.keys;
  const find = (rows: readonly Count[]): string =>
    rows.find((row) => row.id === first)?.label ?? first;
  switch (bucket.kind) {
    case "curve":
      return `Mana value ${curveLabel(first)}`;
    case "color":
    case "presence":
      return colorLabel(first);
    case "colorMulti":
      return `Multicolored with ${colorLabel(first)}`;
    case "heavy":
      return `${colorLabel(first)}, ${String(HEAVY_PIPS)}+ pips`;
    case "colorCurve":
      return `${colorLabel(first)}, mana value ${curveLabel(second)}`;
    case "type":
      return find(stats.types);
    case "pt":
      return `${ptLabel(first)}/${ptLabel(second)}`;
    case "body":
      return `${first}/${second}`;
    case "creatureCurve":
      return `Creatures, mana value ${curveLabel(first)}`;
    case "status":
      return find(stats.status);
    case "tag":
      return find(stats.tags);
  }
}
