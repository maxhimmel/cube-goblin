import { z } from "zod";
import { cardStatusSchema, sectionSchema } from "./schema.ts";

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
  image: z.string(),
  imageLarge: z.string(),
  scryfallUri: z.string(),
});

export const snapshotSchema = z.strictObject({
  id: z.string(),
  createdAt: z.string(),
  cards: z.array(snapshotCardSchema),
  sections: z.array(sectionSchema),
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
export type Vote = (typeof VOTES)[number];
export type CardReview = z.infer<typeof cardReviewSchema>;
export type Review = z.infer<typeof reviewSchema>;
