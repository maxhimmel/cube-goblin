import { z } from "zod";

export const imageUrisSchema = z.looseObject({
  small: z.string().optional(),
  normal: z.string().optional(),
  large: z.string().optional(),
  png: z.string().optional(),
  art_crop: z.string().optional(),
  border_crop: z.string().optional(),
});

export const cardFaceSchema = z.looseObject({
  name: z.string(),
  mana_cost: z.string().optional(),
  type_line: z.string().optional(),
  oracle_text: z.string().optional(),
  colors: z.array(z.string()).optional(),
  power: z.string().optional(),
  toughness: z.string().optional(),
  loyalty: z.string().optional(),
  image_uris: imageUrisSchema.optional(),
});

export const cardSchema = z.looseObject({
  object: z.literal("card"),
  id: z.string(),
  oracle_id: z.string().optional(),
  name: z.string(),
  layout: z.string(),
  mana_cost: z.string().optional(),
  cmc: z.number().optional(),
  type_line: z.string().optional(),
  oracle_text: z.string().optional(),
  power: z.string().optional(),
  toughness: z.string().optional(),
  loyalty: z.string().optional(),
  colors: z.array(z.string()).optional(),
  color_identity: z.array(z.string()),
  produced_mana: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  rarity: z.string(),
  set: z.string(),
  collector_number: z.string(),
  scryfall_uri: z.string(),
  set_name: z.string().optional(),
  released_at: z.string().optional(),
  artist: z.string().nullish(),
  border_color: z.string().optional(),
  frame: z.string().optional(),
  frame_effects: z.array(z.string()).nullish(),
  full_art: z.boolean().optional(),
  promo_types: z.array(z.string()).nullish(),
  image_uris: imageUrisSchema.optional(),
  card_faces: z.array(cardFaceSchema).optional(),
});

export const errorSchema = z.looseObject({
  object: z.literal("error"),
  status: z.number(),
  code: z.string(),
  details: z.string(),
  type: z.string().nullish(),
  warnings: z.array(z.string()).nullish(),
});

function listSchema<T extends z.ZodType>(item: T) {
  return z.looseObject({
    object: z.literal("list"),
    data: z.array(item),
    has_more: z.boolean().default(false),
    next_page: z.string().nullish(),
    total_cards: z.number().nullish(),
    warnings: z.array(z.string()).nullish(),
    not_found: z.array(z.record(z.string(), z.unknown())).nullish(),
  });
}

export const cardListSchema = listSchema(cardSchema);

export const bulkDataSchema = z.looseObject({
  object: z.literal("bulk_data"),
  type: z.string(),
  updated_at: z.string(),
  download_uri: z.string().optional(),
  jsonl_download_uri: z.string().optional(),
});

export const tagSchema = z.looseObject({
  object: z.literal("tag"),
  id: z.string(),
  slug: z.string(),
  label: z.string(),
  type: z.string(),
  child_ids: z.array(z.string()).nullish(),
  taggings: z.array(z.looseObject({ oracle_id: z.string().nullish() })),
});

export type Card = z.infer<typeof cardSchema>;
export type CardFace = z.infer<typeof cardFaceSchema>;
export type ImageUris = z.infer<typeof imageUrisSchema>;
export type ScryfallErrorBody = z.infer<typeof errorSchema>;
export type CardList = z.infer<typeof cardListSchema>;
export type BulkData = z.infer<typeof bulkDataSchema>;
export type ScryfallTag = z.infer<typeof tagSchema>;
