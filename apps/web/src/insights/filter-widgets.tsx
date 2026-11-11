import type { Bucket, CubeStats, Filter, Tag } from "@repo/cube/browser";
import { compileQuery, filterCards, namesStatus, queryParts } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { GridCard } from "../modes/mode.ts";
import type { Hover } from "../strip.tsx";
import { QueryInput } from "../query/query-input.tsx";
import { Preview, Strip } from "../strip.tsx";
import { Block } from "./block.tsx";
import type { BlockId, Dashboard } from "./layout.ts";
import { BLOCKS } from "./layout.ts";

export interface CardSet {
  cards: readonly GridCard[];
  stats: CubeStats;
  bucket: Bucket | undefined;
  selectedBucket: string | undefined;
  pick: (id: string) => void;
}

export type FrameComponent = (props: Parameters<typeof Block>[0]) => ReactNode;

export function BlockBody({ caption, table, children }: Parameters<typeof Block>[0]): ReactNode {
  const [asTable, setAsTable] = useState(false);
  return (
    <>
      {(caption !== undefined || table !== undefined) && (
        <div className="filter-chart-head">
          {caption !== undefined && <p className="muted chart-caption">{caption}</p>}
          {table !== undefined && (
            <button
              type="button"
              className="chart-toggle"
              aria-pressed={asTable}
              onClick={() => {
                setAsTable(!asTable);
              }}
            >
              Table
            </button>
          )}
        </div>
      )}
      <div className="block-body" data-table={asTable}>
        {asTable ? table : children}
      </div>
    </>
  );
}

export function isBlockId(id: string): id is BlockId {
  return BLOCKS.some((block) => block.id === id);
}

const CHARTS = BLOCKS.filter((block) => block.id !== "summary");

function QueryPills({ query }: { query: string }): ReactNode {
  const parts = queryParts(query);
  if (parts.length === 0) {
    return <p className="muted filter-empty">No conditions: every card in the page’s scope.</p>;
  }
  return (
    <ul className="query-readonly" aria-label="Filter query">
      {parts.map((part) => (
        <li
          key={`${String(part.start)}-${part.text}`}
          className="query-pill"
          data-kind={part.kind}
          data-not={part.text.startsWith("-") ? "" : undefined}
        >
          {part.text}
        </li>
      ))}
    </ul>
  );
}

function byCostThenName(a: GridCard, b: GridCard): number {
  return a.cmc - b.cmc || a.name.localeCompare(b.name);
}

export function FilterBlock({
  filter,
  set,
  collapsed,
  onToggle,
  onHide,
  onEdit,
  onView,
  renderChart,
}: {
  filter: Filter;
  set: CardSet;
  collapsed: boolean;
  onToggle: () => void;
  onHide: () => void;
  onEdit: (() => void) | undefined;
  onView: ((view: string) => void) | undefined;
  renderChart: (id: BlockId, set: CardSet) => ReactNode;
}): ReactNode {
  const [hover, setHover] = useState<Hover | undefined>(undefined);
  const [localView, setLocalView] = useState(filter.view);
  const view = onView ? filter.view : localView;
  const chart = isBlockId(view) ? view : undefined;
  return (
    <Block
      title={filter.label}
      heading={
        <>
          {filter.label} <span className="muted">{set.cards.length}</span>
        </>
      }
      collapsed={collapsed}
      onToggle={onToggle}
      onHide={onHide}
      actions={
        <>
          <select
            className="filter-view"
            aria-label={`Show ${filter.label} as`}
            value={view}
            onChange={(event) => {
              const next = event.target.value;
              if (onView) {
                onView(next);
              } else {
                setLocalView(next);
              }
            }}
          >
            <option value="cards">Cards</option>
            {CHARTS.map((block) => (
              <option key={block.id} value={block.id}>
                {block.title}
              </option>
            ))}
          </select>
          {onEdit && (
            <button type="button" className="chart-toggle" onClick={onEdit}>
              Edit
            </button>
          )}
        </>
      }
    >
      <div className="filter-block">
        <QueryPills query={filter.query} />
        {chart ? (
          <div className="filter-chart">{renderChart(chart, set)}</div>
        ) : set.cards.length === 0 ? (
          <p className="muted">No cards match.</p>
        ) : (
          <ul className="bucket-list filter-cards">
            {[...set.cards].sort(byCostThenName).map((card) => (
              <Strip key={card.slug} card={card} onHover={setHover} />
            ))}
          </ul>
        )}
        <Preview hover={hover} />
      </div>
    </Block>
  );
}

export function BlocksMenu({ dashboard }: { dashboard: Dashboard }): ReactNode {
  const hiddenCount = dashboard.specs.filter((block) => dashboard.hidden.has(block.id)).length;
  return (
    <details className="blocks-menu">
      <summary className="toolbar-link">
        Blocks{hiddenCount > 0 && <span className="muted"> ({hiddenCount} hidden)</span>}
      </summary>
      <fieldset className="blocks-menu-list">
        <legend className="visually-hidden">Shown blocks</legend>
        {dashboard.specs.map((block) => (
          <label key={block.id}>
            <input
              type="checkbox"
              checked={!dashboard.hidden.has(block.id)}
              onChange={(event) => {
                dashboard.setHidden(block.id, !event.target.checked);
              }}
            />
            {block.title}
          </label>
        ))}
      </fieldset>
    </details>
  );
}

export function FilterEditor({
  filter,
  isNew,
  cards,
  scoped,
  vocabulary,
  onSave,
  onDelete,
  onClose,
}: {
  filter: Filter;
  isNew: boolean;
  cards: readonly GridCard[];
  scoped: readonly GridCard[];
  vocabulary: readonly Tag[];
  onSave: (filter: Filter) => void;
  onDelete: ((id: string) => void) | undefined;
  onClose: () => void;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const [label, setLabel] = useState(filter.label);
  const [query, setQuery] = useState(filter.query);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const count = filterCards({ query }, cards, scoped).length;
  const name = label.trim();
  const close = (): void => {
    dialog.current?.close();
  };

  return (
    <dialog
      ref={dialog}
      className="filter-editor"
      aria-label={isNew ? "New filter" : `Edit ${filter.label}`}
      onClose={onClose}
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (name === "" || !compileQuery(query).ok) {
            return;
          }
          onSave({ ...filter, label: name, query });
          close();
        }}
      >
        <header className="filter-editor-head">
          <input
            aria-label="Filter name"
            placeholder="Name this filter…"
            value={label}
            required
            autoFocus
            onChange={(event) => {
              setLabel(event.target.value);
            }}
          />
          <span className="muted" data-testid="filter-preview-count">
            {count} card{count === 1 ? "" : "s"}
          </span>
          <button type="button" aria-label="Close filter editor" onClick={close}>
            ×
          </button>
        </header>
        <QueryInput
          initial={filter.query}
          onChange={setQuery}
          vocabulary={vocabulary}
          label="Filter query"
          status={
            namesStatus(query)
              ? "Counts the whole cube (the query names a status)."
              : "Counts the page’s scope; add is:draft, is:prospect, or is:cut to pick one."
          }
        />
        <footer className="filter-editor-foot">
          {!isNew && onDelete && (
            <button
              type="button"
              className="danger"
              onClick={() => {
                onDelete(filter.id);
                close();
              }}
            >
              Delete filter
            </button>
          )}
          <button
            type="submit"
            className="primary"
            disabled={name === "" || !compileQuery(query).ok}
          >
            {isNew ? "Add to dashboard" : "Save"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
