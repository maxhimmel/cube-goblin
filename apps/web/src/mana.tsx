import type { ReactNode } from "react";

const SYMBOL = /\{([^}]+)\}/gu;

const SPECIAL_CLASSES: Record<string, string> = {
  T: "tap",
  Q: "untap",
  E: "e",
  CHAOS: "chaos",
  "∞": "infinity",
  "½": "half",
};

const WORDS: Record<string, string> = {
  W: "white",
  U: "blue",
  B: "black",
  R: "red",
  G: "green",
  C: "colorless",
  S: "snow",
  P: "Phyrexian",
  T: "tap",
  Q: "untap",
  E: "energy",
};

export function manaClass(symbol: string): string {
  return `ms-${SPECIAL_CLASSES[symbol] ?? symbol.replaceAll("/", "").toLowerCase()}`;
}

function spoken(symbol: string): string {
  return symbol
    .split("/")
    .map((part) => WORDS[part] ?? part)
    .join(" or ");
}

export function manaSymbols(cost: string): string[] {
  return [...cost.matchAll(SYMBOL)].map((match) => match[1] ?? "");
}

export function ManaSymbol({ symbol, label }: { symbol: string; label?: string }): ReactNode {
  return (
    <i
      className={`ms ${manaClass(symbol)} ms-cost`}
      role="img"
      aria-label={label ?? spoken(symbol)}
      title={`{${symbol}}`}
    />
  );
}

export function ManaCost({ cost }: { cost: string }): ReactNode {
  if (!cost) {
    return null;
  }
  const faces = cost.split(" // ");
  return (
    <span className="mana-cost" role="img" aria-label={`Mana cost ${cost}`}>
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
