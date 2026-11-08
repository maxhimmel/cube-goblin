import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Review } from "@repo/cube";
import { extractReview, reviewSchema, slugify } from "@repo/cube";
import lzString from "lz-string";
import { chalk } from "zx";
import { REVIEWS_DIR } from "../paths.ts";

export function decodeReview(input: string): Review {
  const trimmed = input.trim();
  if (trimmed.startsWith("<")) {
    const review = extractReview(trimmed);
    if (!review) {
      throw new Error("No embedded review found in this HTML file");
    }
    return review;
  }
  const json = trimmed.startsWith("{")
    ? trimmed
    : lzString.decompressFromEncodedURIComponent(trimmed);
  if (!json) {
    throw new Error("Could not decode review code");
  }
  return reviewSchema.parse(JSON.parse(json));
}

async function readInput(source: string): Promise<string> {
  try {
    return await readFile(source, "utf8");
  } catch {
    return source;
  }
}

export async function importReview(source: string): Promise<number> {
  const review = decodeReview(await readInput(source));
  const dir = join(REVIEWS_DIR, slugify(review.reviewer) || "anonymous");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${review.updatedAt.replace(/[:.]/gu, "-")}.json`);
  await writeFile(path, `${JSON.stringify(review, null, 2)}\n`);
  const reviewed = Object.values(review.cards);
  const votes = (vote: string) => reviewed.filter((card) => card.vote === vote).length;
  console.log(
    chalk.green(
      `Imported review by ${review.reviewer} (snapshot ${review.snapshotId}): ${String(reviewed.length)} cards, ${String(votes("keep"))} keep, ${String(votes("cut"))} cut -> ${path}`,
    ),
  );
  return 0;
}
