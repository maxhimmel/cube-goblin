import { z } from "zod";

export const CARD_STATUSES = ["draft", "prospect", "cut"] as const;

export const cardStatusSchema = z.enum(CARD_STATUSES);

export const cardEntrySchema = z.strictObject({
  name: z.string().min(1),
  oracleId: z.uuid(),
  status: cardStatusSchema,
  section: z.string().optional(),
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
  section: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const sectionSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  label: z.string().min(1),
  header: z.string().min(1),
});

export const sectionsFileSchema = z.strictObject({
  sections: z.array(sectionSchema),
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
export type Section = z.infer<typeof sectionSchema>;
export type CubeConfig = z.infer<typeof cubeConfigSchema>;
