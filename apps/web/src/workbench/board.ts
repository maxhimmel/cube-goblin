import type { Section, Board, CardChange, TagKind, Workbench } from "@repo/cube/browser";
import { EMPTY_BOARD, linkTag, unlinkTag } from "@repo/cube/browser";
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
import { cacheTag } from "./tags.ts";
import { showToast } from "./toast.tsx";

const BOARD_SAVE_KEY = ["board-save"] as const;

type BoardChange = (board: Board) => Board;

let confirmed: Board = EMPTY_BOARD;

async function loadBoard(): Promise<Board> {
  confirmed = await fetchBoard();
  return confirmed;
}

export function useBoard(): { board: Board | undefined; error: Error | null } {
  const { data, error } = useQuery({ queryKey: BOARD_QUERY_KEY, queryFn: loadBoard });
  return { board: data, error };
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
  mutationFn: async (change: BoardChange): Promise<Board> => {
    const next = change(confirmed);
    if (next !== confirmed) {
      confirmed = await saveBoardRequest(next);
    }
    return confirmed;
  },
  onMutate: async (change: BoardChange): Promise<void> => {
    await queryClient.cancelQueries({ queryKey: BOARD_QUERY_KEY });
    queryClient.setQueryData(BOARD_QUERY_KEY, change(currentBoard()));
  },
  onError: (error: Error): void => {
    queryClient.setQueryData(BOARD_QUERY_KEY, confirmed);
    showToast({ message: error.message, tone: "error" });
  },
  onSettled: async (): Promise<void> => {
    if (queryClient.isMutating({ mutationKey: BOARD_SAVE_KEY }) <= 1) {
      await queryClient.invalidateQueries({ queryKey: BOARD_QUERY_KEY });
    }
  },
};

function save(change: BoardChange): Promise<Board> {
  return new MutationObserver(queryClient, boardSaveOptions).mutate(change);
}

export function editBoard(change: BoardChange): void {
  const before = currentBoard();
  if (change(before) !== before) {
    save(change).catch(() => undefined);
  }
}

export function editBoardWithUndo(label: string, change: BoardChange, undo: BoardChange): void {
  save(change).then(
    () => {
      showToast({
        message: label,
        tone: "info",
        action: {
          label: "Undo",
          run: () => {
            editBoard(undo);
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

export function missingTags(section: Section, cube: Workbench): CardChange[] {
  const bySlug = new Map(cube.cards.map((card) => [card.slug, card]));
  return section.cards.flatMap((slug) => {
    const card = bySlug.get(slug);
    const addTags = card ? section.tags.filter((tag) => !card.tags.includes(tag)) : [];
    return addTags.length > 0 ? [{ slug, patch: { addTags } }] : [];
  });
}

export function linkSectionTag(id: string, tag: string): void {
  editBoard((board) => linkTag(board, id, tag));
}

export function unlinkSectionTag(id: string, tag: string): void {
  editBoard((board) => unlinkTag(board, id, tag));
}

export async function createSectionTag(id: string, label: string, kind: TagKind): Promise<void> {
  try {
    const tag = await createTagRequest(label, kind);
    cacheTag(tag);
    linkSectionTag(id, tag.id);
  } catch (error) {
    showToast({ message: error instanceof Error ? error.message : String(error), tone: "error" });
    throw error;
  }
}

export function applySectionTags(id: string): void {
  const cube = queryClient.getQueryData<Workbench>(CUBE_QUERY_KEY);
  const section = currentBoard().sections.find((candidate) => candidate.id === id);
  if (!cube || !section) {
    return;
  }
  const changes = missingTags(section, cube);
  if (changes.length === 0) {
    showToast({ message: `Every card in ${section.label} has its tags`, tone: "info" });
    return;
  }
  const added = changes.reduce((sum, change) => sum + (change.patch.addTags?.length ?? 0), 0);
  const undo: CardChange[] = changes.map(({ slug, patch }) => ({
    slug,
    patch: { removeTags: patch.addTags ?? [] },
  }));
  runCardEdit({
    label: `${String(added)} tag${added === 1 ? "" : "s"} on ${plural(changes.length)}`,
    changes,
    undo,
  });
}
