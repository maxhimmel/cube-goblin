import type { CardReview, PendingMoveEntry, Review, Vote } from "@repo/cube/browser";
import { REVIEW_SCRIPT_ID, embedReview, reviewSchema } from "@repo/cube/browser";
import lzString from "lz-string";
import { useSyncExternalStore } from "react";
import { cubeFileName } from "./cube-identity.ts";
import { snapshot } from "./data.ts";
import { adoptLegacyKey } from "./storage-scope.ts";

export const PRISTINE_HTML = `<!doctype html>\n${document.documentElement.outerHTML}`;

const STORAGE_KEY = `cube:review@${snapshot.id}`;
adoptLegacyKey(`maxs-cube:review:${snapshot.id}`, STORAGE_KEY);

function emptyReview(): Review {
  return {
    version: 1,
    snapshotId: snapshot.id,
    reviewer: "",
    updatedAt: new Date(0).toISOString(),
    cards: {},
    moves: [],
  };
}

function readEmbedded(): Review | undefined {
  const text = document.getElementById(REVIEW_SCRIPT_ID)?.textContent;
  if (!text) {
    return undefined;
  }
  const parsed = reviewSchema.safeParse(JSON.parse(text));
  return parsed.success && parsed.data.snapshotId === snapshot.id ? parsed.data : undefined;
}

function readStored(): Review | undefined {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) {
      return undefined;
    }
    const parsed = reviewSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function newest(...reviews: (Review | undefined)[]): Review {
  return reviews
    .filter((review): review is Review => review !== undefined)
    .reduce((best, review) => (review.updatedAt > best.updatedAt ? review : best), emptyReview());
}

let current: Review = newest(readEmbedded(), readStored());
const listeners = new Set<() => void>();

function commit(next: Review): void {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useReview(): Review {
  return useSyncExternalStore(subscribe, () => current);
}

export function setReviewer(reviewer: string): void {
  commit({ ...current, reviewer, updatedAt: new Date().toISOString() });
}

export function updateCard(
  slug: string,
  patch: Partial<Pick<CardReview, "comment" | "vote">>,
): void {
  const now = new Date().toISOString();
  const previous: CardReview = current.cards[slug] ?? { comment: "", vote: null, updatedAt: now };
  commit({
    ...current,
    updatedAt: now,
    cards: { ...current.cards, [slug]: { ...previous, ...patch, updatedAt: now } },
  });
}

export function setMoves(moves: readonly PendingMoveEntry[]): void {
  commit({ ...current, moves: [...moves], updatedAt: new Date().toISOString() });
}

export function useMoves(): [
  readonly PendingMoveEntry[],
  (next: readonly PendingMoveEntry[]) => void,
] {
  return [useReview().moves, setMoves];
}

export function toggleVote(slug: string, vote: Vote): void {
  updateCard(slug, { vote: current.cards[slug]?.vote === vote ? null : vote });
}

export function reviewCode(): string {
  return lzString.compressToEncodedURIComponent(JSON.stringify(current));
}

export function savedDocument(): string {
  return embedReview(PRISTINE_HTML, current);
}

export function downloadSavedDocument(): void {
  const blob = new Blob([savedDocument()], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const who =
    current.reviewer
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-") || "review";
  link.href = url;
  link.download = cubeFileName(who);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
