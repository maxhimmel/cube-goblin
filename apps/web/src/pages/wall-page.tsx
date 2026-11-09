import { mode } from "#mode";
import type { CardStatus, Column, ColumnAxis } from "@repo/cube/browser";
import { COLUMN_AXES, columnsBy } from "@repo/cube/browser";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import { useState } from "react";
import { Gauge } from "../gauge.tsx";
import { ManaSymbol } from "../mana.tsx";
import type { GridCard } from "../modes/mode.ts";
import type { Hover } from "../strip.tsx";
import { DRAG_TYPE, Preview, Strip } from "../strip.tsx";

const SYMBOL_COLUMNS: Record<ColumnAxis, ReadonlySet<string>> = {
  mv: new Set(["0", "1", "2", "3", "4", "5", "6", "7"]),
  color: new Set(["W", "U", "B", "R", "G", "C"]),
  type: new Set(),
};

function ColumnHead({ column, axis }: { column: Column<GridCard>; axis: ColumnAxis }): ReactNode {
  const symbol = SYMBOL_COLUMNS[axis].has(column.id);
  return (
    <div className="column-head">
      {symbol ? (
        <span className="column-symbol">
          <ManaSymbol symbol={column.id} label={column.label} />
          {column.label.endsWith("+") && "+"}
        </span>
      ) : (
        <span className="column-label">{column.label}</span>
      )}
      <span className="column-count">{column.cards.length}</span>
    </div>
  );
}

function Columns({
  columns,
  axis,
  onHover,
  heads,
}: {
  columns: Column<GridCard>[];
  axis: ColumnAxis;
  onHover: (hover: Hover | undefined) => void;
  heads: boolean;
}): ReactNode {
  return (
    <div className="columns" style={{ "--columns": columns.length } as CSSProperties}>
      {columns.map((column) => (
        <section key={column.id} className="column" data-column={column.id}>
          {heads ? (
            <ColumnHead column={column} axis={axis} />
          ) : (
            <div className="column-head column-head-small">
              <span className="column-label">{column.label}</span>
              <span className="column-count">{column.cards.length}</span>
            </div>
          )}
          <ul className="stack">
            {column.cards.map((card) => (
              <Strip key={card.slug} card={card} onHover={onHover} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface DropZone {
  "data-drop": string | undefined;
  onDragOver?: (event: DragEvent) => void;
  onDragLeave?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
}

function useDropZone(status: CardStatus, cards: readonly GridCard[]): DropZone {
  const [over, setOver] = useState(false);
  const move = mode.moveCard;
  if (move === undefined) {
    return { "data-drop": undefined };
  }
  return {
    "data-drop": over ? "over" : undefined,
    onDragOver: (event) => {
      if (event.dataTransfer.types.includes(DRAG_TYPE)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }
    },
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setOver(false);
      }
    },
    onDrop: (event) => {
      event.preventDefault();
      setOver(false);
      const slug = event.dataTransfer.getData(DRAG_TYPE);
      const card = cards.find((candidate) => candidate.slug === slug);
      if (card) {
        move(card, status);
      }
    },
  };
}

export function WallPage(): ReactNode {
  const cube = mode.useCube();
  const { by } = useSearch({ from: "/" });
  const navigate = useNavigate();
  const [hover, setHover] = useState<Hover | undefined>(undefined);
  const [trayOpen, setTrayOpen] = useState(true);
  const cards = cube?.cards ?? [];
  const toDraft = useDropZone("draft", cards);
  const toProspects = useDropZone("prospect", cards);
  if (!cube) {
    return <p className="muted">Loading cube…</p>;
  }
  const axis: ColumnAxis = COLUMN_AXES.find((option) => option.id === by)?.id ?? "mv";
  const allDraft = columnsBy(
    cube.cards.filter((card) => card.status === "draft"),
    axis,
  );
  const allProspects = columnsBy(
    cube.cards.filter((card) => card.status === "prospect"),
    axis,
  );
  const used = (index: number): boolean =>
    (allDraft[index]?.cards.length ?? 0) + (allProspects[index]?.cards.length ?? 0) > 0;
  const draft = allDraft.filter((_, index) => used(index));
  const prospects = allProspects.filter((_, index) => used(index));
  const drafted = draft.reduce((total, column) => total + column.cards.length, 0);
  const prospectCount = prospects.reduce((total, column) => total + column.cards.length, 0);

  return (
    <div className="wall">
      <div className="wall-tools">
        <h1 className="wall-title">
          Draft <span className="muted">{drafted}</span>
        </h1>
        {cube.size && <Gauge count={drafted} size={cube.size} />}
        <div className="segmented" role="group" aria-label="Columns">
          {COLUMN_AXES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={option.id === axis}
              onClick={() => {
                void navigate({
                  to: "/",
                  search: (prev) => ({ ...prev, by: option.id === "mv" ? undefined : option.id }),
                });
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="wall-body" {...toDraft}>
        <Columns columns={draft} axis={axis} onHover={setHover} heads />
      </div>
      <section className="tray" data-open={trayOpen} {...toProspects}>
        <button
          type="button"
          className="tray-toggle"
          aria-expanded={trayOpen}
          onClick={() => {
            setTrayOpen(!trayOpen);
          }}
        >
          Prospects <span className="muted">{prospectCount}</span>
        </button>
        {trayOpen && (
          <div className="tray-body">
            <Columns columns={prospects} axis={axis} onHover={setHover} heads={false} />
          </div>
        )}
      </section>
      <Preview hover={hover} />
    </div>
  );
}
