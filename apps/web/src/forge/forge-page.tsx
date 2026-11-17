import type { ReactNode } from "react";
import { useState } from "react";
import { z } from "zod";
import { SortMenu } from "../sort-chain.tsx";
import { Preview } from "../strip.tsx";
import { useRemembered } from "../view-choices.ts";
import { mode } from "#mode";
import { CardColumns, CardImages, CardRows } from "./cards.tsx";
import { CompareMenu } from "./compare-blocks.tsx";
import { BlocksMenu, DockBlocks, useDockState } from "./dock.tsx";
import { LayoutsMenu } from "./layouts-menu.tsx";
import { PendingGutter, usePendingOpen } from "./pending.tsx";
import { AxisTabs, DraftCount, QueryBar, Segmented, Toggle } from "./toolbar.tsx";
import type { Lab } from "./use-lab.ts";
import { InTopbar } from "../topbar-slot.tsx";
import { Seam } from "./seam.tsx";
import { useLab } from "./use-lab.ts";
import { usePlacedDock, useStripTags } from "./view-settings.tsx";

type CardView = "columns" | "rows" | "images";

const LAYOUT_PATHS: Record<CardView, ReactNode> = {
  columns: <path d="M3.5 4h4v16h-4zM10 4h4v11h-4zM16.5 4h4v13.5h-4z" />,
  rows: <path d="M4 5.5h16M4 10h16M4 14.5h16M4 19h16" />,
  images: <path d="M4 4h6.5v7.5H4zM13.5 4H20v7.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z" />,
};

function LayoutIcon({ name }: { name: CardView }): ReactNode {
  return (
    <svg className="lab-seg-icon" viewBox="0 0 24 24" aria-hidden="true">
      {LAYOUT_PATHS[name]}
    </svg>
  );
}

function LabView({ lab, onApply }: { lab: Lab; onApply: () => void }): ReactNode {
  const dockAt = usePlacedDock();
  const [tags, setTags] = useStripTags();
  const [open, setOpen] = useRemembered("labc.dockOpen", true, z.boolean());
  const [view, setView] = useRemembered<CardView>(
    "labc.view",
    "columns",
    z.enum(["columns", "rows", "images"]),
  );
  const dock = useDockState();
  const [pendingOpen, setPendingOpen] = usePendingOpen();
  const draft = lab.cards.filter((card) => card.status === "draft");
  const prospects = lab.cards.filter((card) => card.status !== "draft");
  const pile = (cards: typeof draft, compact: boolean): ReactNode =>
    view === "columns" ? (
      <CardColumns lab={lab} cards={cards} compact={compact} tags={tags} />
    ) : view === "rows" ? (
      <CardRows lab={lab} cards={cards} />
    ) : (
      <CardImages lab={lab} cards={cards} compact={compact} />
    );
  return (
    <div
      className="lab"
      data-dock={dockAt}
      data-dock-open={open ? "" : undefined}
      data-pending-open={pendingOpen ? "" : undefined}
      {...lab.dragRoot}
    >
      <InTopbar>
        <DraftCount lab={lab} />
      </InTopbar>
      <header className="lab-top">
        <h1 className="sr-only">Forge</h1>
        <QueryBar lab={lab} />
        <div className="lab-controls">
          <CompareMenu compare={lab.compare} />
          <BlocksMenu dock={dock} />
          <LayoutsMenu onApply={onApply} />
        </div>
      </header>
      {open && (
        <div className="lab-dock">
          <DockBlocks lab={lab} dock={dock} />
        </div>
      )}
      <Seam placed={dockAt} open={open} setOpen={setOpen} />
      <div className="lab-floor">
        <section className="lab-pile" aria-label="Draft" {...lab.zone("draft")}>
          <header className="lab-pile-head">
            <h2>Draft</h2>
            <div className="lab-pile-tools">
              <Segmented
                label="Card layout"
                options={[
                  { id: "columns", label: <LayoutIcon name="columns" />, title: "Columns" },
                  { id: "rows", label: <LayoutIcon name="rows" />, title: "Rows" },
                  { id: "images", label: <LayoutIcon name="images" />, title: "Images" },
                ]}
                value={view}
                onChange={(next) => {
                  if (next !== "images") {
                    mode.clearSelection?.();
                  }
                  setView(next);
                }}
              />
              {view === "columns" && (
                <div className="lab-switches">
                  <Toggle label="Tags" checked={tags} onChange={setTags} />
                </div>
              )}
              <AxisTabs lab={lab} />
              <SortMenu keys={lab.sort} onChange={lab.setSort} />
            </div>
          </header>
          {pile(draft, false)}
          {view === "images" && (
            <div className="lab-bulk-slot">
              <mode.BulkBar />
            </div>
          )}
        </section>
        <PendingGutter lab={lab} tags={tags} open={pendingOpen} setOpen={setPendingOpen} />
        <section
          className="lab-pile"
          data-pile="prospects"
          aria-label="Prospects"
          {...lab.zone("prospect")}
        >
          <header className="lab-pile-head">
            <h2>
              Prospects <span className="muted">{prospects.length}</span>
            </h2>
            <div className="lab-switches">
              <Toggle label="Show cut" checked={lab.showCut} onChange={lab.setShowCut} />
            </div>
          </header>
          {pile(prospects, true)}
        </section>
      </div>
      <Preview hover={lab.hover} />
    </div>
  );
}

function LabRoot({ onApply }: { onApply: () => void }): ReactNode {
  const lab = useLab();
  if (!lab) {
    return <p className="muted">Loading cube…</p>;
  }
  return <LabView lab={lab} onApply={onApply} />;
}

export function ForgePage(): ReactNode {
  const [round, setRound] = useState(0);
  return (
    <LabRoot
      key={round}
      onApply={() => {
        setRound(round + 1);
      }}
    />
  );
}
