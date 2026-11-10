import { z } from "zod";

export const CARD_STATUSES = ["draft", "prospect", "cut"] as const;

export const cardStatusSchema = z.enum(CARD_STATUSES);

export const cardEntrySchema = z.strictObject({
  name: z.string().min(1),
  oracleId: z.uuid(),
  status: cardStatusSchema,
  printing: z.uuid().optional(),
  tags: z.array(z.string()),
  notes: z.string(),
  source: z.strictObject({
    batch: z.string(),
    line: z.int().positive(),
    input: z.string(),
  }),
});

export const cardPatchSchema = z.strictObject({
  status: cardStatusSchema.optional(),
  printing: z.uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  addTags: z.array(z.string()).optional(),
  removeTags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export function applyTagChanges(tags: readonly string[], patch: CardPatch): string[] {
  const base = patch.tags ?? tags;
  const removed = new Set(patch.removeTags ?? []);
  const kept = base.filter((tag) => !removed.has(tag));
  const added = (patch.addTags ?? []).filter((tag) => !kept.includes(tag));
  return [...kept, ...added];
}

interface PatchableCard {
  status: CardStatus;
  printing?: string | undefined;
  tags: string[];
  notes: string;
}

export function applyCardPatch<T extends PatchableCard>(card: T, patch: CardPatch): T {
  const { printing, ...rest } = card;
  const nextPrinting = patch.printing === undefined ? printing : (patch.printing ?? undefined);
  const next: PatchableCard = {
    ...rest,
    status: patch.status ?? card.status,
    notes: patch.notes ?? card.notes,
    tags: applyTagChanges(card.tags, patch),
    ...(nextPrinting === undefined ? {} : { printing: nextPrinting }),
  };
  return next as T;
}

export const cardChangeSchema = z.strictObject({
  slug: z.string(),
  patch: cardPatchSchema,
});

export const cardChangesSchema = z.strictObject({
  changes: z.array(cardChangeSchema).min(1),
});

export const newCardSchema = z.strictObject({
  oracleId: z.uuid(),
  status: cardStatusSchema,
  replaces: z.string().optional(),
  copyTags: z.boolean().optional(),
});

export const TAG_KINDS = ["archetype", "group"] as const;

export const tagKindSchema = z.enum(TAG_KINDS);

export const tagSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  label: z.string().trim().min(1),
  kind: tagKindSchema,
});

export const tagsFileSchema = z.strictObject({
  tags: z.array(tagSchema),
});

export const newTagSchema = tagSchema.pick({ label: true, kind: true });

export const tagChangeSchema = tagSchema.pick({ label: true, kind: true }).partial();

export const binSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  label: z.string().trim().min(1),
  cards: z.array(z.string()),
  tag: z.string().optional(),
});

export const boardSchema = z.strictObject({
  bins: z.array(binSchema),
});

export const cubeConfigSchema = z.strictObject({
  format: z.enum(["winston"]),
  size: z
    .strictObject({ min: z.int().positive(), max: z.int().positive() })
    .refine((size) => size.min <= size.max, "size.min must be <= size.max"),
});

export type CardStatus = z.infer<typeof cardStatusSchema>;
export type CardEntry = z.infer<typeof cardEntrySchema>;
export type CardPatch = z.infer<typeof cardPatchSchema>;
export type NewCard = z.infer<typeof newCardSchema>;
export type CardChange = z.infer<typeof cardChangeSchema>;
export type TagKind = z.infer<typeof tagKindSchema>;
export type Tag = z.infer<typeof tagSchema>;
export type Bin = z.infer<typeof binSchema>;
export type Board = z.infer<typeof boardSchema>;
export type CubeConfig = z.infer<typeof cubeConfigSchema>;
