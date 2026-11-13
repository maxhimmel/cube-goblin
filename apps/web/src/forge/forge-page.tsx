import type { ReactNode } from "react";
import { useState } from "react";
import { z } from "zod";
import { SortMenu } from "../sort-chain.tsx";
import { Preview } from "../strip.tsx";
import { useRemembered } from "../view-choices.ts";
import { mode } from "#mode";
import { CardColumns, CardImages, CardRows } from "./cards.tsx";
import { BlocksMenu, DockBlocks, useDockState } from "./dock.tsx";
import { LayoutsMenu } from "./layouts-menu.tsx";
import { PendingGutter, usePendingOpen } from "./pending.tsx";
import { AxisTabs, DraftCount, QueryBar, Segmented, Toggle } from "./toolbar.tsx";
import type { Lab } from "./use-lab.ts";
import { useLab } from "./use-lab.ts";
import { usePlacedDock, useStripTags } from "./view-settings.tsx";

type CardView = "columns" | "rows" | "images";

function LabView({ lab, onApply }: { lab: Lab; onApply: () => void }): ReactNode {
  const dockAt = usePlacedDock();
  const [tags] = useStripTags();
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
      <header className="lab-top">
        <h1>Forge</h1>
        <DraftCount lab={lab} />
        <QueryBar lab={lab} />
        <div className="lab-controls">
          <BlocksMenu dock={dock} />
          <LayoutsMenu onApply={onApply} />
          <div className="lab-switches">
            <Toggle label="Charts" checked={open} onChange={setOpen} />
            <Toggle label="Baseline" checked={lab.baseline} onChange={lab.setBaseline} />
            <Toggle label="Show cut" checked={lab.showCut} onChange={lab.setShowCut} />
          </div>
        </div>
      </header>
      {open && (
        <div className="lab-dock">
          <DockBlocks lab={lab} dock={dock} />
        </div>
      )}
      <div className="lab-floor">
        <section className="lab-pile" aria-label="Draft" {...lab.zone("draft")}>
          <header className="lab-pile-head">
            <h2>Draft</h2>
            <div className="lab-pile-tools">
              <Segmented
                label="Card layout"
                options={[
                  { id: "columns", label: "Columns" },
                  { id: "rows", label: "Rows" },
                  { id: "images", label: "Images" },
                ]}
                value={view}
                onChange={(next) => {
                  if (next !== "images") {
                    mode.clearSelection?.();
                  }
                  setView(next);
                }}
              />
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
