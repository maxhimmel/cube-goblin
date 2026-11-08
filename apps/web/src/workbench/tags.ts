import type { Tag, TagKind, Workbench } from "@repo/cube/browser";
import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../query-client.ts";
import { CUBE_QUERY_KEY, changeTagRequest, createTagRequest } from "./api.ts";
import { editsPending } from "./edits.ts";
import { showToast } from "./toast.tsx";

export interface NewTag {
  label: string;
  kind: TagKind;
}

export interface TagChange {
  id: string;
  label?: string;
  kind?: TagKind;
}

function reportError(error: Error): void {
  showToast({ message: error.message, tone: "error" });
}

async function refresh(): Promise<void> {
  if (!editsPending()) {
    await queryClient.invalidateQueries({ queryKey: CUBE_QUERY_KEY });
  }
}

function cacheTag(tag: Tag): void {
  queryClient.setQueryData<Workbench>(CUBE_QUERY_KEY, (cube) => {
    if (!cube) {
      return cube;
    }
    const known = cube.vocabulary.some((other) => other.id === tag.id);
    return {
      ...cube,
      vocabulary: known
        ? cube.vocabulary.map((other) => (other.id === tag.id ? tag : other))
        : [...cube.vocabulary, tag],
    };
  });
}

export function findTag(vocabulary: readonly Tag[], text: string): Tag | undefined {
  const wanted = text.trim().toLowerCase();
  return vocabulary.find((tag) => tag.label.toLowerCase() === wanted || tag.id === wanted);
}

export function useCreateTag(): UseMutationResult<Tag, Error, NewTag> {
  return useMutation({
    mutationFn: ({ label, kind }: NewTag) => createTagRequest(label, kind),
    onSuccess: cacheTag,
    onError: reportError,
    onSettled: refresh,
  });
}

export function useChangeTag(): UseMutationResult<Tag, Error, TagChange> {
  return useMutation({
    mutationFn: ({ id, ...change }: TagChange) => changeTagRequest(id, change),
    onSuccess: (tag) => {
      cacheTag(tag);
      showToast({ message: `Saved tag ${tag.label}`, tone: "info" });
    },
    onError: reportError,
    onSettled: refresh,
  });
}
