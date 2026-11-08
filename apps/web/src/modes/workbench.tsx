import type { Workbench, WorkbenchCard } from "@repo/cube/browser";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryClient } from "../query-client.ts";
import { CUBE_CHANGED_EVENT, CUBE_QUERY_KEY, fetchCube } from "../workbench/api.ts";
import { CardEditor } from "../workbench/card-editor.tsx";
import { useSaving } from "../workbench/edits.ts";
import { Toaster } from "../workbench/toast.tsx";
import type { Mode } from "./mode.ts";

if (import.meta.hot) {
  import.meta.hot.on(CUBE_CHANGED_EVENT, () => {
    void queryClient.invalidateQueries({ queryKey: CUBE_QUERY_KEY });
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
  return <CardEditor key={slug} card={card} sections={data.sections} />;
}

export const mode: Mode = {
  name: "workbench",
  useCube: () => {
    const data = useWorkbench();
    return data && { cards: data.cards, sections: data.sections, label: "live from cube/cards" };
  },
  useTileMark: (slug) => ({ "data-status": useWorkbenchCard(slug)?.status }),
  Toolbar,
  CardPanel,
};
