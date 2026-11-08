import type { CardEntry, CardPatch, Workbench, WorkbenchCard } from "@repo/cube/browser";
import { applyTagChanges } from "@repo/cube/browser";
import type { UseMutationResult } from "@tanstack/react-query";
import { MutationObserver, useIsMutating, useMutation } from "@tanstack/react-query";
import { queryClient } from "../query-client.ts";
import { CUBE_QUERY_KEY, sendPatch } from "./api.ts";
import { showToast } from "./toast.tsx";

export interface CardEdit {
  slug: string;
  label: string;
  patch: CardPatch;
  undo?: CardPatch;
}

const CARD_EDIT_KEY = ["card-edit"] as const;

export function applyPatch(card: WorkbenchCard, patch: CardPatch): WorkbenchCard {
  const { section, ...rest } = card;
  const nextSection = patch.section === undefined ? section : (patch.section ?? undefined);
  return {
    ...rest,
    status: patch.status ?? card.status,
    notes: patch.notes ?? card.notes,
    tags: applyTagChanges(card.tags, patch),
    ...(nextSection === undefined ? {} : { section: nextSection }),
  };
}

function patchCached(slug: string, patch: CardPatch): void {
  queryClient.setQueryData<Workbench>(
    CUBE_QUERY_KEY,
    (cube) =>
      cube && {
        ...cube,
        cards: cube.cards.map((card) => (card.slug === slug ? applyPatch(card, patch) : card)),
      },
  );
}

export function editsPending(): boolean {
  return queryClient.isMutating({ mutationKey: CARD_EDIT_KEY }) > 0;
}

const cardEditOptions = {
  mutationKey: CARD_EDIT_KEY,
  scope: { id: "card-edit" },
  mutationFn: ({ slug, patch }: CardEdit): Promise<CardEntry> => sendPatch(slug, patch),
  onMutate: async ({ slug, patch }: CardEdit): Promise<void> => {
    await queryClient.cancelQueries({ queryKey: CUBE_QUERY_KEY });
    patchCached(slug, patch);
  },
  onError: (error: Error, edit: CardEdit): void => {
    if (edit.undo !== undefined) {
      patchCached(edit.slug, edit.undo);
    }
    showToast({ message: error.message, tone: "error" });
  },
  onSuccess: (_entry: CardEntry, edit: CardEdit): void => {
    const { undo } = edit;
    if (undo === undefined) {
      showToast({ message: `Undid ${edit.label}`, tone: "info" });
      return;
    }
    showToast({
      message: `Saved ${edit.label}`,
      tone: "info",
      action: {
        label: "Undo",
        run: () => {
          runCardEdit({ slug: edit.slug, label: edit.label, patch: undo });
        },
      },
    });
  },
  onSettled: async (): Promise<void> => {
    if (queryClient.isMutating({ mutationKey: CARD_EDIT_KEY }) <= 1) {
      await queryClient.invalidateQueries({ queryKey: CUBE_QUERY_KEY });
    }
  },
};

export function runCardEdit(edit: CardEdit): void {
  new MutationObserver(queryClient, cardEditOptions).mutate(edit).catch(() => undefined);
}

export function useCardEdit(): UseMutationResult<CardEntry, Error, CardEdit> {
  return useMutation(cardEditOptions);
}

export function useSaving(): boolean {
  return useIsMutating({ mutationKey: CARD_EDIT_KEY }) > 0;
}
