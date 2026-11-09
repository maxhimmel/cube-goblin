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

export interface DisplayFields {
  manaCost: string;
  typeLine: string;
  oracleText: string;
  cmc: number;
  colors: string[];
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
    colors: card.colors ?? faces[0]?.colors ?? card.color_identity,
    image: small,
    imageLarge: large,
    scryfallUri: card.scryfall_uri.split("?")[0] ?? card.scryfall_uri,
  };
}
