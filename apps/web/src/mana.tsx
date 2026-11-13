import type { ReactNode } from "react";
import { z } from "zod";
import { useRemembered } from "./view-choices.ts";

const SYMBOL = /\{([^}]+)\}/gu;

const SPECIAL_CLASSES: Record<string, string> = {
  T: "tap",
  Q: "untap",
  E: "e",
  CHAOS: "chaos",
  "∞": "infinity",
  "½": "1-2",
};

const HALF = /^H([WUBRG])$/u;

const WORDS: Record<string, string> = {
  W: "white",
  U: "blue",
  B: "black",
  R: "red",
  G: "green",
  C: "colorless",
  S: "snow",
  T: "tap",
  Q: "untap",
  E: "energy",
  "½": "half",
  "∞": "infinity",
};

export function manaClass(symbol: string): string {
  const half = HALF.exec(symbol)?.[1];
  if (half !== undefined) {
    return `ms-${half.toLowerCase()} ms-half`;
  }
  return `ms-${SPECIAL_CLASSES[symbol] ?? symbol.replaceAll("/", "").toLowerCase()}`;
}

export function spokenSymbol(symbol: string): string {
  const half = HALF.exec(symbol)?.[1];
  if (half !== undefined) {
    return `half ${WORDS[half] ?? half}`;
  }
  const parts = symbol.split("/");
  const phyrexian = parts.at(-1) === "P";
  const colors = (phyrexian ? parts.slice(0, -1) : parts).map((part) => WORDS[part] ?? part);
  return `${phyrexian ? "Phyrexian " : ""}${colors.join(" or ")}`;
}

export function spokenCost(cost: string): string {
  return cost
    .split(" // ")
    .map((face) => manaSymbols(face).map(spokenSymbol).join(", "))
    .join(", then ");
}

export function manaSymbols(cost: string): string[] {
  return [...cost.matchAll(SYMBOL)].map((match) => match[1] ?? "");
}

export function ManaSymbol({ symbol, label }: { symbol: string; label?: string }): ReactNode {
  return (
    <i
      className={`ms ${manaClass(symbol)} ms-cost`}
      role="img"
      aria-label={label ?? spokenSymbol(symbol)}
    />
  );
}

export function ManaCost({ cost }: { cost: string }): ReactNode {
  if (!cost) {
    return null;
  }
  const faces = cost.split(" // ");
  return (
    <span className="mana-cost" role="img" aria-label={`Mana cost: ${spokenCost(cost)}`}>
      {faces.map((face, index) => (
        <span key={index} aria-hidden="true">
          {index > 0 && " // "}
          {manaSymbols(face).map((symbol, position) => (
            <i key={position} className={`ms ${manaClass(symbol)} ms-cost`} title={`{${symbol}}`} />
          ))}
        </span>
      ))}
    </span>
  );
}

export const MULTICOLOR_STYLES = ["black", "white"] as const;
export type MulticolorStyle = (typeof MULTICOLOR_STYLES)[number];

export function useMulticolorStyle(): [MulticolorStyle, (style: MulticolorStyle) => void] {
  return useRemembered<MulticolorStyle>("look.multicolor", "black", z.enum(MULTICOLOR_STYLES));
}

const STAR = "M10 3.2Q11.3 8.7 16.8 10Q11.3 11.3 10 16.8Q8.7 11.3 3.2 10Q8.7 8.7 10 3.2Z";

export function MulticolorSymbol({
  label,
  style: chosen,
}: {
  label?: string;
  style?: MulticolorStyle;
}): ReactNode {
  const [stored] = useMulticolorStyle();
  const style = chosen ?? stored;
  return (
    <i
      className="ms ms-cost ms-gold"
      data-star={style}
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d={STAR} />
      </svg>
      {style === "black" && <i className="ms ms-c" aria-hidden="true" />}
    </i>
  );
}
