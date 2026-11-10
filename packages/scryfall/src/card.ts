import type { Card, CardFace } from "./schemas.ts";

export type ImageVersion = "small" | "normal" | "large" | "png" | "art_crop" | "border_crop";

export function cardFaces(card: Card): CardFace[] {
  if (card.card_faces && card.card_faces.length > 0) {
    return card.card_faces;
  }
  const face: CardFace = { name: card.name };
  if (card.mana_cost !== undefined) {
    face.mana_cost = card.mana_cost;
  }
  if (card.type_line !== undefined) {
    face.type_line = card.type_line;
  }
  if (card.oracle_text !== undefined) {
    face.oracle_text = card.oracle_text;
  }
  return [face];
}

export function imageUrl(card: Card, version: ImageVersion = "normal"): string | undefined {
  return card.image_uris?.[version] ?? card.card_faces?.[0]?.image_uris?.[version];
}

const FRAME_LABELS: Record<string, string> = {
  showcase: "showcase",
  extendedart: "extended art",
  etched: "etched",
  inverted: "inverted",
};

export function printingLabels(card: Card): string[] {
  const labels: string[] = [];
  if (card.border_color === "borderless") {
    labels.push("borderless");
  }
  for (const effect of card.frame_effects ?? []) {
    const label = FRAME_LABELS[effect];
    if (label !== undefined && !labels.includes(label)) {
      labels.push(label);
    }
  }
  if (card.full_art === true) {
    labels.push("full art");
  }
  if (card.frame === "1993" || card.frame === "1997") {
    labels.push("retro frame");
  }
  if (card.set === "spg") {
    labels.push("special guest");
  }
  if (card.promo_types?.includes("sldbonus") === true) {
    labels.push("bonus");
  }
  return labels;
}

export interface Printing {
  id: string;
  set: string;
  setName: string;
  collectorNumber: string;
  releasedAt: string;
  artist: string;
  labels: string[];
  image: string;
  imageLarge: string;
}

export function printingSummary(card: Card): Printing | undefined {
  const image = imageUrl(card, "small");
  const imageLarge = imageUrl(card, "large");
  if (!image || !imageLarge) {
    return undefined;
  }
  return {
    id: card.id,
    set: card.set,
    setName: card.set_name ?? card.set.toUpperCase(),
    collectorNumber: card.collector_number,
    releasedAt: card.released_at ?? "",
    artist: card.artist ?? "",
    labels: printingLabels(card),
    image,
    imageLarge,
  };
}

export interface DisplayFields {
  manaCost: string;
  typeLine: string;
  oracleText: string;
  cmc: number;
  colors: string[];
  producedMana: string[];
  image: string;
  imageLarge: string;
  scryfallUri: string;
}

export function displayFields(card: Card): DisplayFields | undefined {
  const small = imageUrl(card, "small");
  const large = imageUrl(card, "large");
  if (!small || !large) {
    return undefined;
  }
  const faces = cardFaces(card);
  return {
    manaCost: card.mana_cost ?? faces[0]?.mana_cost ?? "",
    typeLine: card.type_line ?? "",
    oracleText: faces.map((face) => face.oracle_text ?? "").join("\n//\n"),
    cmc: card.cmc ?? 0,
    colors: card.colors ?? faces[0]?.colors ?? [],
    producedMana: card.produced_mana ?? [],
    image: small,
    imageLarge: large,
    scryfallUri: card.scryfall_uri.split("?")[0] ?? card.scryfall_uri,
  };
}
