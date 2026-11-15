import { z } from "zod";
import { CARD_STATUSES, cardStatusSchema } from "./schema.ts";

export const boardChoiceSchema = z.enum([...CARD_STATUSES, "skip"]);

export const importSourceSchema = z.union([
  z.strictObject({ text: z.string().min(1) }),
  z.strictObject({ url: z.string().min(1) }),
]);

export const importRequestSchema = z.strictObject({
  source: importSourceSchema,
  boards: z.record(z.string(), boardChoiceSchema).default({}),
  edits: z.record(z.string(), z.string()).default({}),
  into: z.enum(["current", "new"]).default("current"),
});

const lineSchema = z.strictObject({ line: z.int(), input: z.string(), name: z.string() });

export const importPreviewSchema = z.strictObject({
  format: z.string(),
  title: z.string().optional(),
  boards: z.array(z.strictObject({ board: z.string(), count: z.int(), status: boardChoiceSchema })),
  added: z.array(
    lineSchema.extend({
      card: z.string(),
      status: cardStatusSchema,
      tags: z.array(z.string()),
      how: z.enum(["printing", "mtgo", "set-number", "name", "fuzzy"]),
    }),
  ),
  misses: z.array(lineSchema.extend({ reason: z.string() })),
  skipped: z.array(lineSchema.extend({ reason: z.string() })),
  warnings: z.array(lineSchema.extend({ message: z.string() })),
  newTags: z.array(z.string()),
});

export const importResultSchema = z.strictObject({
  added: z.int(),
  title: z.string().optional(),
});

export type BoardChoice = z.infer<typeof boardChoiceSchema>;
export type ImportSource = z.infer<typeof importSourceSchema>;
export type ImportRequest = z.infer<typeof importRequestSchema>;
export type ImportRequestInput = z.input<typeof importRequestSchema>;
export type ImportPreview = z.infer<typeof importPreviewSchema>;
export type ImportOutcome = z.infer<typeof importResultSchema>;
