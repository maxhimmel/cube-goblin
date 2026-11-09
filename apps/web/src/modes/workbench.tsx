import type { Workbench, WorkbenchCard } from "@repo/cube/browser";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { queryClient } from "../query-client.ts";
import { CUBE_CHANGED_EVENT, CUBE_QUERY_KEY, fetchCube } from "../workbench/api.ts";
import { AddPage } from "../workbench/add-page.tsx";
import { BulkBar, SelectCard, SelectPile } from "../workbench/bulk.tsx";
import { CardEditor } from "../workbench/card-editor.tsx";
import { editsPending, runCardEdit, useSaving } from "../workbench/edits.ts";
import { useSelection } from "../workbench/selection.ts";
import { TagsPage } from "../workbench/tags-page.tsx";
import { Toaster } from "../workbench/toast.tsx";
import type { Mode } from "./mode.ts";

async function refetchCube(): Promise<void> {
  if (editsPending()) {
    return;
  }
  await queryClient.cancelQueries({ queryKey: CUBE_QUERY_KEY });
  await queryClient.invalidateQueries({ queryKey: CUBE_QUERY_KEY });
}

if (import.meta.hot) {
  import.meta.hot.on(CUBE_CHANGED_EVENT, () => {
    void refetchCube();
  });
}

function useWorkbench(): Workbench | undefined {
  return useQuery({ queryKey: CUBE_QUERY_KEY, queryFn: fetchCube }).data;
}

function useWorkbenchCard(slug: string): WorkbenchCard | undefined {
  return useWorkbench()?.cards.find((card) => card.slug === slug);
}

function Toolbar(): ReactNode {
  const { error } = useQuery({ queryKey: CUBE_QUERY_KEY, queryFn: fetchCube });
  const saving = useSaving();
  return (
    <>
      <span className="badge">workbench · live</span>
      <Link to="/add" className="toolbar-link">
        Add card
      </Link>
      <Link to="/tags" className="toolbar-link">
        Tags
      </Link>
      <span className="muted" data-testid="save-state">
        {saving ? "saving…" : "all changes saved"}
      </span>
      {error && (
        <span role="alert" className="error">
          {error.message}
        </span>
      )}
      <Toaster />
    </>
  );
}

function CardPanel({ slug }: { slug: string }): ReactNode {
  const data = useWorkbench();
  const card = data?.cards.find((candidate) => candidate.slug === slug);
  if (!data || !card) {
    return null;
  }
  return (
    <CardEditor key={slug} card={card} sections={data.sections} vocabulary={data.vocabulary} />
  );
}

export const mode: Mode = {
  name: "workbench",
  moveCard: (card, status) => {
    if (card.status === status) {
      return;
    }
    runCardEdit({
      label: `${card.name} → ${status}`,
      changes: [{ slug: card.slug, patch: { status } }],
      undo: [{ slug: card.slug, patch: { status: card.status } }],
    });
  },
  useCube: () => {
    const data = useWorkbench();
    return (
      data && {
        cards: data.cards,
        sections: data.sections,
        vocabulary: data.vocabulary,
        label: "live from cube/cards",
        size: data.size,
        functionsAsOf: data.functionsAsOf,
      }
    );
  },
  useTileMark: (slug) => ({
    "data-status": useWorkbenchCard(slug)?.status,
    "data-selected": useSelection().has(slug) ? "true" : undefined,
  }),
  Toolbar,
  CardPanel,
  TagsPage: () => <TagsPage cube={useWorkbench()} />,
  SelectCard,
  SelectPile,
  BulkBar: () => <BulkBar cube={useWorkbench()} />,
  useSelection,
  AddPage: ({ replaces }) => (
    <AddPage key={replaces ?? ""} cube={useWorkbench()} replaces={replaces} />
  ),
};
