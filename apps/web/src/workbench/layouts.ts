import type { Layout, LayoutsFile } from "@repo/cube/browser";
import { EMPTY_LAYOUTS } from "@repo/cube/browser";
import { MutationObserver, useQuery } from "@tanstack/react-query";
import { queryClient } from "../query-client.ts";
import { LAYOUTS_QUERY_KEY, fetchLayouts, saveLayoutsRequest } from "./api.ts";
import { showToast } from "./toast.tsx";

const LAYOUTS_SAVE_KEY = ["layouts-save"] as const;

type LayoutsChange = (layouts: readonly Layout[]) => Layout[];

let confirmed: LayoutsFile = EMPTY_LAYOUTS;

async function loadLayouts(): Promise<LayoutsFile> {
  confirmed = await fetchLayouts();
  return confirmed;
}

export function useWorkbenchLayouts(): Layout[] | undefined {
  return useQuery({ queryKey: LAYOUTS_QUERY_KEY, queryFn: loadLayouts }).data?.layouts;
}

function current(): LayoutsFile {
  return queryClient.getQueryData<LayoutsFile>(LAYOUTS_QUERY_KEY) ?? EMPTY_LAYOUTS;
}

const saveOptions = {
  mutationKey: LAYOUTS_SAVE_KEY,
  scope: { id: "layouts-save" },
  mutationFn: async (change: LayoutsChange): Promise<LayoutsFile> => {
    confirmed = await saveLayoutsRequest({ layouts: change(confirmed.layouts) });
    return confirmed;
  },
  onMutate: async (change: LayoutsChange): Promise<void> => {
    await queryClient.cancelQueries({ queryKey: LAYOUTS_QUERY_KEY });
    queryClient.setQueryData(LAYOUTS_QUERY_KEY, { layouts: change(current().layouts) });
  },
  onError: (error: Error): void => {
    queryClient.setQueryData(LAYOUTS_QUERY_KEY, confirmed);
    showToast({ message: error.message, tone: "error" });
  },
  onSettled: async (): Promise<void> => {
    if (queryClient.isMutating({ mutationKey: LAYOUTS_SAVE_KEY }) <= 1) {
      await queryClient.invalidateQueries({ queryKey: LAYOUTS_QUERY_KEY });
    }
  },
};

function save(change: LayoutsChange): Promise<LayoutsFile> {
  return new MutationObserver(queryClient, saveOptions).mutate(change);
}

export function putLayout(layout: Layout): void {
  save((layouts) =>
    layouts.some((entry) => entry.id === layout.id)
      ? layouts.map((entry) => (entry.id === layout.id ? layout : entry))
      : [...layouts, layout],
  ).catch(() => undefined);
}

export function deleteLayout(id: string): void {
  const before = current().layouts;
  const index = before.findIndex((entry) => entry.id === id);
  const removed = before[index];
  if (!removed) {
    return;
  }
  save((layouts) => layouts.filter((entry) => entry.id !== id)).then(
    () => {
      showToast({
        message: `Deleted ${removed.label}`,
        tone: "info",
        action: {
          label: "Undo",
          run: () => {
            save((layouts) => {
              const next = layouts.filter((entry) => entry.id !== id);
              next.splice(Math.min(index, next.length), 0, removed);
              return next;
            }).catch(() => undefined);
          },
        },
      });
    },
    () => undefined,
  );
}
