import type { Workbench, WorkbenchCard } from "@repo/cube/browser";
import { pendingMoveSchema } from "@repo/cube/browser";
import { z } from "zod";
import { useRemembered } from "../view-choices.ts";
import {
  deleteFilter,
  filterSavesPending,
  putFilter,
  useWorkbenchFilters,
} from "../workbench/filters.ts";
import {
  deleteLayout,
  layoutSavesPending,
  putLayout,
  useWorkbenchLayouts,
} from "../workbench/layouts.ts";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { PlusIcon, SettingsIcon } from "../icons.tsx";
import { onCubeChanged } from "../desktop-bridge.ts";
import { queryClient } from "../query-client.ts";
import {
  BOARD_QUERY_KEY,
  VERSIONS_QUERY_KEY,
  LOG_QUERY_KEY,
  CONFIG_QUERY_KEY,
  FILTERS_QUERY_KEY,
  LAYOUTS_QUERY_KEY,
  CUBE_QUERY_KEY,
  fetchConfig,
  fetchCube,
} from "../workbench/api.ts";
import { setCubeIdentity } from "../cube-identity.ts";
import { scopeStorage } from "../storage-scope.ts";
import { CubeSwitcher } from "../workbench/cube-switcher.tsx";
import { OFFLINE_REASON, useOnline } from "../workbench/connection.ts";
import { boardSavesPending } from "../workbench/board.ts";
import { AddPanel } from "../workbench/add-panel.tsx";
import { BulkBar, SelectCard, SelectPile } from "../workbench/bulk.tsx";
import { CardEditor, CardPrinting } from "../workbench/card-editor.tsx";
import { CardHistory } from "../workbench/card-history.tsx";
import { editsPending, runCardEdit } from "../workbench/edits.ts";
import { clearSelection, useSelection } from "../workbench/selection.ts";
import { SettingsPanel } from "../workbench/settings-panel.tsx";
import { TagsPage } from "../workbench/tags-page.tsx";
import { WorkbenchHistoryPage } from "../workbench/history-page.tsx";
import { Toaster } from "../workbench/toast.tsx";
import type { Mode } from "./mode.ts";

async function refetch(key: readonly string[], pending: () => boolean): Promise<void> {
  if (pending()) {
    return;
  }
  await queryClient.cancelQueries({ queryKey: key });
  await queryClient.invalidateQueries({ queryKey: key });
}

onCubeChanged(() => {
  void refetch(CUBE_QUERY_KEY, editsPending);
  void refetch(BOARD_QUERY_KEY, boardSavesPending);
  void refetch(FILTERS_QUERY_KEY, filterSavesPending);
  void refetch(LAYOUTS_QUERY_KEY, layoutSavesPending);
  void queryClient.invalidateQueries({ queryKey: VERSIONS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: LOG_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: CONFIG_QUERY_KEY });
});

function useWorkbench(): Workbench | undefined {
  return useQuery({ queryKey: CUBE_QUERY_KEY, queryFn: fetchCube }).data;
}

function useWorkbenchCard(slug: string): WorkbenchCard | undefined {
  return useWorkbench()?.cards.find((card) => card.slug === slug);
}

function Toolbar(): ReactNode {
  const { error } = useQuery({ queryKey: CUBE_QUERY_KEY, queryFn: fetchCube });
  const saving = useIsMutating() > 0;
  const [settings, setSettings] = useState(false);
  const online = useOnline();
  return (
    <div className="topbar-actions">
      {!online && (
        <span
          className="offline-state"
          role="status"
          title={`${OFFLINE_REASON}. Cached cards and edits keep working; search, adding cards, and printings not yet saved need a connection.`}
        >
          Offline
        </span>
      )}
      {error ? (
        <span role="alert" className="error save-state" data-testid="save-state">
          {error.message}
        </span>
      ) : (
        <span className="muted save-state" data-testid="save-state" data-saving={saving}>
          {saving ? "Saving…" : "Saved"}
        </span>
      )}
      <Link
        to="."
        search={(prev) => ({ ...prev, add: true, replaces: undefined })}
        resetScroll={false}
        className="icon-button"
        aria-label="Add card"
        title="Add card"
      >
        <PlusIcon />
      </Link>
      <button
        type="button"
        className="icon-button"
        aria-label="Settings"
        title="Settings"
        aria-expanded={settings}
        onClick={() => {
          setSettings(true);
        }}
      >
        <SettingsIcon />
      </button>
      {settings && (
        <SettingsPanel
          onClose={() => {
            setSettings(false);
          }}
        />
      )}
      <Toaster />
    </div>
  );
}

function CardPanel({ slug }: { slug: string }): ReactNode {
  const data = useWorkbench();
  const card = data?.cards.find((candidate) => candidate.slug === slug);
  if (!data || !card) {
    return null;
  }
  return (
    <>
      <CardEditor key={slug} card={card} vocabulary={data.vocabulary} />
      <CardHistory card={card} />
    </>
  );
}

const pendingSchema = z.array(pendingMoveSchema).readonly();

export const mode: Mode = {
  usePending: () => useRemembered("pending.lab", [], pendingSchema),
  useFilters: useWorkbenchFilters,
  putFilter,
  deleteFilter,
  useLayouts: useWorkbenchLayouts,
  putLayout,
  deleteLayout,
  name: "workbench",
  boot: async () => {
    const config = await queryClient.query({
      queryKey: CONFIG_QUERY_KEY,
      queryFn: fetchConfig,
    });
    scopeStorage(config.id, "");
    setCubeIdentity(config);
  },
  CubeSwitcher,
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
  moveCards: (moves, label, body) => {
    const real = moves.filter((move) => move.card.status !== move.status);
    if (real.length === 0) {
      return;
    }
    runCardEdit({
      label,
      ...(body === undefined ? {} : { body }),
      changes: real.map((move) => ({ slug: move.card.slug, patch: { status: move.status } })),
      undo: real.map((move) => ({ slug: move.card.slug, patch: { status: move.card.status } })),
    });
  },
  useCube: () => {
    const data = useWorkbench();
    return (
      data && {
        cards: data.cards,
        vocabulary: data.vocabulary,
        size: data.size,
      }
    );
  },
  useTileMark: (slug) => ({
    "data-status": useWorkbenchCard(slug)?.status,
    "data-selected": useSelection().has(slug) ? "true" : undefined,
  }),
  Toolbar,
  CardPanel,
  CardImageCaption: ({ slug }) => {
    const card = useWorkbenchCard(slug);
    return card ? <CardPrinting card={card} /> : null;
  },
  TagsPage: () => <TagsPage cube={useWorkbench()} />,
  HistoryPage: () => <WorkbenchHistoryPage cube={useWorkbench()} />,
  SelectCard,
  SelectPile,
  BulkBar: () => <BulkBar cube={useWorkbench()} />,
  useSelection,
  clearSelection,
  AddPanel: ({ replaces }) => <AddPanel cube={useWorkbench()} replaces={replaces} />,
};
