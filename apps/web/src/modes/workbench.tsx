import type { Workbench, WorkbenchCard } from "@repo/cube/browser";
import { workbenchSchema } from "@repo/cube/browser";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { queryClient } from "../query-client.ts";
import type { Mode } from "./mode.ts";

export const CUBE_QUERY_KEY = ["cube"] as const;
export const CUBE_CHANGED_EVENT = "cube:changed";

async function fetchCube(): Promise<Workbench> {
  const response = await fetch("/api/cube");
  if (!response.ok) {
    throw new Error(`GET /api/cube failed: ${String(response.status)} ${await response.text()}`);
  }
  return workbenchSchema.parse(await response.json());
}

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
  return (
    <>
      <span className="badge">workbench · live</span>
      {error && (
        <span role="alert" className="error">
          {error.message}
        </span>
      )}
    </>
  );
}

function CardPanel({ slug }: { slug: string }): ReactNode {
  const card = useWorkbenchCard(slug);
  if (!card) {
    return null;
  }
  return (
    <dl className="facts">
      <dt>Status</dt>
      <dd data-testid="card-status">{card.status}</dd>
      <dt>Section</dt>
      <dd>{card.section ?? "none"}</dd>
      <dt>Tags</dt>
      <dd>{card.tags.length > 0 ? card.tags.join(", ") : "none"}</dd>
      <dt>Notes</dt>
      <dd data-testid="card-notes">{card.notes || "none"}</dd>
    </dl>
  );
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
