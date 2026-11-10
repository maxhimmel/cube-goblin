import { z } from "zod";
import { CARD_FUNCTION_IDS } from "./functions.ts";
import { cardStatusSchema, cubeConfigSchema, sectionSchema, tagSchema } from "./schema.ts";

export const snapshotCardSchema = z.strictObject({
  slug: z.string(),
  name: z.string(),
  oracleId: z.string(),
  status: cardStatusSchema,
  section: z.string().optional(),
  manaCost: z.string(),
  typeLine: z.string(),
  oracleText: z.string(),
  cmc: z.number(),
  colors: z.array(z.string()),
  functions: z.array(z.enum(CARD_FUNCTION_IDS)),
  image: z.string(),
  imageLarge: z.string(),
  scryfallUri: z.string(),
});

export const snapshotSchema = z.strictObject({
  id: z.string(),
  createdAt: z.string(),
  cards: z.array(snapshotCardSchema),
  sections: z.array(sectionSchema),
  functionsAsOf: z.string().optional(),
});

export const printingSchema = z.strictObject({
  id: z.string(),
  set: z.string(),
  setName: z.string(),
  collectorNumber: z.string(),
  releasedAt: z.string(),
  artist: z.string(),
  labels: z.array(z.string()),
  image: z.string(),
  imageLarge: z.string(),
});

export const workbenchCardSchema = snapshotCardSchema.extend({
  printing: z.string().optional(),
  shown: printingSchema.pick({ id: true, setName: true, collectorNumber: true }),
  tags: z.array(z.string()),
  notes: z.string(),
});

export const workbenchSchema = z.strictObject({
  cards: z.array(workbenchCardSchema),
  sections: z.array(sectionSchema),
  vocabulary: z.array(tagSchema),
  size: cubeConfigSchema.shape.size,
  functionsAsOf: z.string().optional(),
});

export const searchResultSchema = z.strictObject({
  oracleId: z.string(),
  name: z.string(),
  manaCost: z.string(),
  typeLine: z.string(),
  image: z.string(),
  inCube: z.boolean(),
});

export const VOTES = ["keep", "cut"] as const;

export const cardReviewSchema = z.strictObject({
  comment: z.string(),
  vote: z.enum(VOTES).nullable(),
  updatedAt: z.string(),
});

export const reviewSchema = z.strictObject({
  version: z.literal(1),
  snapshotId: z.string(),
  reviewer: z.string(),
  updatedAt: z.string(),
  cards: z.record(z.string(), cardReviewSchema),
});

export const REVIEW_SCRIPT_ID = "review-state";

export type SnapshotCard = z.infer<typeof snapshotCardSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type WorkbenchCard = z.infer<typeof workbenchCardSchema>;
export type Workbench = z.infer<typeof workbenchSchema>;
export type Printing = z.infer<typeof printingSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type Vote = (typeof VOTES)[number];
export type CardReview = z.infer<typeof cardReviewSchema>;
export type Review = z.infer<typeof reviewSchema>;
