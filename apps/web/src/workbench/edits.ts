import type { CardChange, CardEntry, Workbench } from "@repo/cube/browser";
import { applyCardPatch } from "@repo/cube/browser";
import type { UseMutationResult } from "@tanstack/react-query";
import { MutationObserver, useMutation } from "@tanstack/react-query";
import { queryClient } from "../query-client.ts";
import { CUBE_QUERY_KEY, sendChanges } from "./api.ts";
import { showToast } from "./toast.tsx";

export interface CardEdit {
  label: string;
  subject?: string;
  body?: string;
  changes: CardChange[];
  undo?: CardChange[];
}

const CARD_EDIT_KEY = ["card-edit"] as const;

function patchCached(changes: readonly CardChange[]): void {
  queryClient.setQueryData<Workbench>(
    CUBE_QUERY_KEY,
    (cube) =>
      cube && {
        ...cube,
        cards: cube.cards.map((card) =>
          changes
            .filter((change) => change.slug === card.slug)
            .reduce((next, change) => applyCardPatch(next, change.patch), card),
        ),
      },
  );
}

export function editsPending(): boolean {
  return queryClient.isMutating({ mutationKey: CARD_EDIT_KEY }) > 0;
}

const cardEditOptions = {
  mutationKey: CARD_EDIT_KEY,
  scope: { id: "card-edit" },
  mutationFn: (edit: CardEdit): Promise<CardEntry[]> =>
    sendChanges(edit.changes, false, { subject: edit.subject ?? edit.label, body: edit.body }),
  onMutate: async ({ changes }: CardEdit): Promise<void> => {
    await queryClient.cancelQueries({ queryKey: CUBE_QUERY_KEY });
    patchCached(changes);
  },
  onError: (error: Error): void => {
    showToast({ message: error.message, tone: "error" });
  },
  onSuccess: (_entries: CardEntry[], edit: CardEdit): void => {
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
          const subject = edit.subject ?? edit.label;
          runCardEdit({
            label: edit.label,
            subject: subject === "" ? "" : `Undo ${subject}`,
            changes: undo,
          });
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

export function useCardEdit(): UseMutationResult<CardEntry[], Error, CardEdit> {
  return useMutation(cardEditOptions);
}
