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
