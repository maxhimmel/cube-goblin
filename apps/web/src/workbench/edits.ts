import type { CardEntry, CardPatch, Workbench, WorkbenchCard } from "@repo/cube/browser";
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

interface Rollback {
  previous: Workbench | undefined;
}

const CARD_EDIT_KEY = ["card-edit"] as const;

export function applyPatch(card: WorkbenchCard, patch: CardPatch): WorkbenchCard {
  const { section, ...rest } = card;
  const nextSection = patch.section === undefined ? section : (patch.section ?? undefined);
  return {
    ...rest,
    ...(patch.status === undefined ? {} : { status: patch.status }),
    ...(patch.tags === undefined ? {} : { tags: patch.tags }),
    ...(patch.notes === undefined ? {} : { notes: patch.notes }),
    ...(nextSection === undefined ? {} : { section: nextSection }),
  };
}

const cardEditOptions = {
  mutationKey: CARD_EDIT_KEY,
  scope: { id: "card-edit" },
  mutationFn: ({ slug, patch }: CardEdit): Promise<CardEntry> => sendPatch(slug, patch),
  onMutate: async ({ slug, patch }: CardEdit): Promise<Rollback> => {
    await queryClient.cancelQueries({ queryKey: CUBE_QUERY_KEY });
    const previous = queryClient.getQueryData<Workbench>(CUBE_QUERY_KEY);
    if (previous) {
      queryClient.setQueryData<Workbench>(CUBE_QUERY_KEY, {
        ...previous,
        cards: previous.cards.map((card) => (card.slug === slug ? applyPatch(card, patch) : card)),
      });
    }
    return { previous };
  },
  onError: (error: Error, _edit: CardEdit, rollback: Rollback | undefined): void => {
    if (rollback?.previous) {
      queryClient.setQueryData(CUBE_QUERY_KEY, rollback.previous);
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
  onSettled: (): Promise<void> => queryClient.invalidateQueries({ queryKey: CUBE_QUERY_KEY }),
};

export function runCardEdit(edit: CardEdit): void {
  new MutationObserver(queryClient, cardEditOptions).mutate(edit).catch(() => undefined);
}

export function useCardEdit(): UseMutationResult<CardEntry, Error, CardEdit, Rollback> {
  return useMutation(cardEditOptions);
}

export function useSaving(): boolean {
  return useIsMutating({ mutationKey: CARD_EDIT_KEY }) > 0;
}
