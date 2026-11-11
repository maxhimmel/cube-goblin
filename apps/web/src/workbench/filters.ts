import type { Filter, FiltersFile } from "@repo/cube/browser";
import { EMPTY_FILTERS } from "@repo/cube/browser";
import { MutationObserver, useQuery } from "@tanstack/react-query";
import { queryClient } from "../query-client.ts";
import { FILTERS_QUERY_KEY, fetchFilters, saveFiltersRequest } from "./api.ts";
import { showToast } from "./toast.tsx";

const FILTERS_SAVE_KEY = ["filters-save"] as const;

type FiltersChange = (filters: readonly Filter[]) => Filter[];

let confirmed: FiltersFile = EMPTY_FILTERS;

async function loadFilters(): Promise<FiltersFile> {
  confirmed = await fetchFilters();
  return confirmed;
}

export function useWorkbenchFilters(): Filter[] | undefined {
  return useQuery({ queryKey: FILTERS_QUERY_KEY, queryFn: loadFilters }).data?.filters;
}

export function filterSavesPending(): boolean {
  return queryClient.isMutating({ mutationKey: FILTERS_SAVE_KEY }) > 0;
}

function current(): FiltersFile {
  return queryClient.getQueryData<FiltersFile>(FILTERS_QUERY_KEY) ?? EMPTY_FILTERS;
}

const saveOptions = {
  mutationKey: FILTERS_SAVE_KEY,
  scope: { id: "filters-save" },
  mutationFn: async (change: FiltersChange): Promise<FiltersFile> => {
    confirmed = await saveFiltersRequest({ filters: change(confirmed.filters) });
    return confirmed;
  },
  onMutate: async (change: FiltersChange): Promise<void> => {
    await queryClient.cancelQueries({ queryKey: FILTERS_QUERY_KEY });
    queryClient.setQueryData(FILTERS_QUERY_KEY, { filters: change(current().filters) });
  },
  onError: (error: Error): void => {
    queryClient.setQueryData(FILTERS_QUERY_KEY, confirmed);
    showToast({ message: error.message, tone: "error" });
  },
  onSettled: async (): Promise<void> => {
    if (queryClient.isMutating({ mutationKey: FILTERS_SAVE_KEY }) <= 1) {
      await queryClient.invalidateQueries({ queryKey: FILTERS_QUERY_KEY });
    }
  },
};

function save(change: FiltersChange): Promise<FiltersFile> {
  return new MutationObserver(queryClient, saveOptions).mutate(change);
}

export function putFilter(filter: Filter): void {
  save((filters) =>
    filters.some((entry) => entry.id === filter.id)
      ? filters.map((entry) => (entry.id === filter.id ? filter : entry))
      : [...filters, filter],
  ).catch(() => undefined);
}

export function deleteFilter(id: string): void {
  const before = current().filters;
  const index = before.findIndex((entry) => entry.id === id);
  const removed = before[index];
  if (!removed) {
    return;
  }
  save((filters) => filters.filter((entry) => entry.id !== id)).then(
    () => {
      showToast({
        message: `Deleted ${removed.label}`,
        tone: "info",
        action: {
          label: "Undo",
          run: () => {
            save((filters) => {
              const next = filters.filter((entry) => entry.id !== id);
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
