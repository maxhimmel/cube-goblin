import type { ExportCard } from "./types.ts";

export type NameStyle = "full" | "spaced-slash" | "front-except-split" | "cockatrice" | "mtgo";

const SEPARATOR = " // ";

function frontFace(name: string): string {
  return name.split(SEPARATOR)[0] ?? name;
}

export function exportName(card: Pick<ExportCard, "name" | "layout">, style: NameStyle): string {
  if (!card.name.includes(SEPARATOR) || style === "full") {
    return card.name;
  }
  if (style === "spaced-slash") {
    return card.name.split(SEPARATOR).join(" / ");
  }
  if (style === "mtgo") {
    return card.layout === "split" ? card.name.split(SEPARATOR).join("/") : frontFace(card.name);
  }
  if (style === "cockatrice" && ["split", "adventure", "prepare"].includes(card.layout)) {
    return card.name;
  }
  return card.layout === "split" ? card.name : frontFace(card.name);
}

export function nameCandidates(name: string): string[] {
  const candidates = [name];
  const slashed = name.replace(/\s*(?<!\/)[/|](?!\/)\s*/gu, SEPARATOR);
  if (slashed !== name) {
    candidates.push(slashed);
  }
  for (const candidate of [...candidates]) {
    const front = frontFace(candidate);
    if (front !== candidate) {
      candidates.push(front);
    }
  }
  return [...new Set(candidates)];
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/æ/gu, "ae")
    .replace(/[^a-z0-9]/gu, "");
}
