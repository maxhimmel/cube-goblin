import type { Bin, Board, CardChange, Tag, TagKind, Workbench } from "@repo/cube/browser";
import { EMPTY_BOARD, changeBin } from "@repo/cube/browser";
import { MutationObserver, useQuery } from "@tanstack/react-query";
import { queryClient } from "../query-client.ts";
import {
  BOARD_QUERY_KEY,
  CUBE_QUERY_KEY,
  createTagRequest,
  fetchBoard,
  saveBoardRequest,
} from "./api.ts";
import { runCardEdit } from "./edits.ts";
import { cacheTag, findTag } from "./tags.ts";
import { showToast } from "./toast.tsx";

const BOARD_SAVE_KEY = ["board-save"] as const;

export function useBoard(): Board | undefined {
  return useQuery({ queryKey: BOARD_QUERY_KEY, queryFn: fetchBoard }).data;
}

export function boardSavesPending(): boolean {
  return queryClient.isMutating({ mutationKey: BOARD_SAVE_KEY }) > 0;
}

function currentBoard(): Board {
  return queryClient.getQueryData<Board>(BOARD_QUERY_KEY) ?? EMPTY_BOARD;
}

const boardSaveOptions = {
  mutationKey: BOARD_SAVE_KEY,
  scope: { id: "board-save" },
  mutationFn: (board: Board): Promise<Board> => saveBoardRequest(board),
  onMutate: async (board: Board): Promise<void> => {
    await queryClient.cancelQueries({ queryKey: BOARD_QUERY_KEY });
    queryClient.setQueryData(BOARD_QUERY_KEY, board);
  },
  onError: (error: Error): void => {
    showToast({ message: error.message, tone: "error" });
  },
  onSettled: async (): Promise<void> => {
    if (queryClient.isMutating({ mutationKey: BOARD_SAVE_KEY }) <= 1) {
      await queryClient.invalidateQueries({ queryKey: BOARD_QUERY_KEY });
    }
  },
};

function save(board: Board): Promise<Board> {
  return new MutationObserver(queryClient, boardSaveOptions).mutate(board);
}

export function editBoard(change: (board: Board) => Board): void {
  const before = currentBoard();
  const next = change(before);
  if (next !== before) {
    save(next).catch(() => undefined);
  }
}

export function editBoardWithUndo(label: string, change: (board: Board) => Board): void {
  const before = currentBoard();
  save(change(before)).then(
    () => {
      showToast({
        message: label,
        tone: "info",
        action: {
          label: "Undo",
          run: () => {
            save(before).catch(() => undefined);
          },
        },
      });
    },
    () => undefined,
  );
}

function plural(count: number): string {
  return `${String(count)} card${count === 1 ? "" : "s"}`;
}

export function untagged(bin: Bin, cube: Workbench): string[] {
  const bySlug = new Map(cube.cards.map((card) => [card.slug, card]));
  return bin.cards.filter((slug) => {
    const card = bySlug.get(slug);
    return card !== undefined && bin.tag !== undefined && !card.tags.includes(bin.tag);
  });
}

async function binTag(bin: Bin, cube: Workbench, kind: TagKind): Promise<Tag> {
  const linked = cube.vocabulary.find((tag) => tag.id === bin.tag);
  if (linked) {
    return linked;
  }
  const known = findTag(cube.vocabulary, bin.label);
  if (known) {
    return known;
  }
  const created = await createTagRequest(bin.label, kind);
  cacheTag(created);
  return created;
}

export async function promoteBin(id: string, kind: TagKind): Promise<void> {
  const cube = queryClient.getQueryData<Workbench>(CUBE_QUERY_KEY);
  const bin = currentBoard().bins.find((candidate) => candidate.id === id);
  if (!cube || !bin) {
    return;
  }
  let tag: Tag;
  try {
    tag = await binTag(bin, cube, kind);
    if (bin.tag !== tag.id) {
      await save(changeBin(currentBoard(), id, { tag: tag.id }));
    }
  } catch (error) {
    showToast({ message: error instanceof Error ? error.message : String(error), tone: "error" });
    return;
  }
  const slugs = untagged({ ...bin, tag: tag.id }, cube);
  if (slugs.length === 0) {
    showToast({ message: `Every card in ${bin.label} has tag ${tag.label}`, tone: "info" });
    return;
  }
  const changes: CardChange[] = slugs.map((slug) => ({ slug, patch: { addTags: [tag.id] } }));
  const undo: CardChange[] = slugs.map((slug) => ({ slug, patch: { removeTags: [tag.id] } }));
  runCardEdit({ label: `tag ${tag.label} on ${plural(slugs.length)}`, changes, undo });
}
