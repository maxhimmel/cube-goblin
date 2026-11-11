import type { Bucket, ChipState, CubeStats, Filter, FilterChip, Tag } from "@repo/cube/browser";
import {
  CARD_STATUSES,
  CARD_STATUS_LABELS,
  COLORS,
  COLOR_GROUPS,
  CURVE_COLUMNS,
  TYPE_COLUMNS,
  bucketId,
  chipState,
  cycleChip,
  filterCards,
  hasStatusChip,
  parseBucket,
} from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { GridCard } from "../modes/mode.ts";
import type { Hover } from "../strip.tsx";
import { Preview, Strip } from "../strip.tsx";
import { Block } from "./block.tsx";
import { bucketLabel, colorIcon, colorLabel, curveTick } from "./labels.tsx";
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

export function chipLabel(chip: FilterChip, stats: CubeStats): string {
  const bucket = parseBucket(chip.bucket);
  return bucket ? bucketLabel(bucket, stats) : chip.bucket;
}

const COLOR_KINDS: ReadonlySet<string> = new Set(["color", "presence", "colorMulti", "heavy"]);

function chipIcon(chip: FilterChip): ReactNode {
  const bucket = parseBucket(chip.bucket);
  const first = bucket?.keys[0] ?? "";
  if (bucket?.kind === "curve") {
    return curveTick(first);
  }
  return bucket && COLOR_KINDS.has(bucket.kind) ? colorIcon(first) : null;
}

function ChipList({
  chips,
  stats,
  vocabulary,
}: {
  chips: readonly FilterChip[];
  stats: CubeStats;
  vocabulary: readonly Tag[];
}): ReactNode {
  if (chips.length === 0) {
    return <p className="muted filter-empty">No chips: every card in the page’s scope.</p>;
  }
  const kinds = new Map(vocabulary.map((tag) => [tag.id, tag.kind]));
  return (
    <ul className="chips filter-chips" aria-label="Filter chips">
      {chips.map((chip) => {
        const bucket = parseBucket(chip.bucket);
        const kind = bucket?.kind === "tag" ? kinds.get(bucket.keys[0] ?? "") : undefined;
        return (
          <li
            key={chip.bucket}
            className="chip filter-chip"
            data-not={chip.not === true}
            data-kind={kind}
          >
            {chip.not && <span className="visually-hidden">not </span>}
            {chipIcon(chip)} {chipLabel(chip, stats)}
          </li>
        );
      })}
    </ul>
  );
}

function byCostThenName(a: GridCard, b: GridCard): number {
  return a.cmc - b.cmc || a.name.localeCompare(b.name);
}

export function FilterBlock({
  filter,
  set,
  vocabulary,
  collapsed,
  onToggle,
  onHide,
  onEdit,
  onView,
  renderChart,
}: {
  filter: Filter;
  set: CardSet;
  vocabulary: readonly Tag[];
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
        <ChipList chips={filter.chips} stats={set.stats} vocabulary={vocabulary} />
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

interface PaletteChip {
  bucket: string;
  label: string;
  icon?: ReactNode;
  iconOnly?: boolean;
  kind?: string | undefined;
}

function paletteRows(vocabulary: readonly Tag[]): { title: string; chips: PaletteChip[] }[] {
  return [
    {
      title: "Status",
      chips: CARD_STATUSES.map((status) => ({
        bucket: bucketId("status", status),
        label: CARD_STATUS_LABELS[status],
      })),
    },
    {
      title: "Color",
      chips: COLOR_GROUPS.map((group) => ({
        bucket: bucketId("color", group.id),
        label: group.label,
        icon: colorIcon(group.id),
      })),
    },
    {
      title: "Has color",
      chips: COLORS.map((color) => ({
        bucket: bucketId("presence", color.id),
        label: colorLabel(color.id),
        icon: colorIcon(color.id),
      })),
    },
    {
      title: "Mana value",
      chips: CURVE_COLUMNS.map((column) => ({
        bucket: bucketId("curve", column.id),
        label: `Mana value ${column.label}`,
        icon: curveTick(column.id),
        iconOnly: true,
      })),
    },
    {
      title: "Card type",
      chips: TYPE_COLUMNS.map((type) => ({ bucket: bucketId("type", type.id), label: type.label })),
    },
    {
      title: "Tags",
      chips: vocabulary.map((tag) => ({
        bucket: bucketId("tag", tag.id),
        label: tag.label,
        kind: tag.kind,
      })),
    },
  ];
}

const STATE_HINT: Record<ChipState, string> = {
  off: "",
  with: "",
  without: "not ",
};

export function FilterEditor({
  filter,
  isNew,
  cards,
  scoped,
  vocabulary,
  labelOf,
  onSave,
  onDelete,
  onClose,
}: {
  filter: Filter;
  isNew: boolean;
  cards: readonly GridCard[];
  scoped: readonly GridCard[];
  vocabulary: readonly Tag[];
  labelOf: (chip: FilterChip) => string;
  onSave: (filter: Filter) => void;
  onDelete: ((id: string) => void) | undefined;
  onClose: () => void;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const [label, setLabel] = useState(filter.label);
  const [chips, setChips] = useState<FilterChip[]>(filter.chips);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const rows = paletteRows(vocabulary);
  const inPalette = new Set(rows.flatMap((row) => row.chips.map((chip) => chip.bucket)));
  const extra = chips.filter((chip) => !inPalette.has(chip.bucket));
  const count = filterCards({ chips }, cards, scoped).length;
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
          if (name === "") {
            return;
          }
          onSave({ ...filter, label: name, chips });
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
        <p className="muted filter-editor-hint">
          Click a chip to include it, again to exclude it, and once more to clear it. Chips of one
          kind match any of them; tags and different kinds must all match.
          {hasStatusChip({ chips }) ? "" : " With no status chip, it counts the page’s scope."}
        </p>
        {rows.map((row) => (
          <fieldset key={row.title} className="filter-palette">
            <legend>{row.title}</legend>
            {row.chips.length === 0 && <span className="muted">None yet.</span>}
            {row.chips.map((chip) => {
              const state = chipState(chips, chip.bucket);
              return (
                <button
                  key={chip.bucket}
                  type="button"
                  className="chip filter-chip"
                  data-state={state}
                  data-kind={chip.kind}
                  aria-label={`${STATE_HINT[state]}${chip.label}`}
                  aria-pressed={state === "off" ? "false" : state === "with" ? "true" : "mixed"}
                  onClick={() => {
                    setChips(cycleChip(chips, chip.bucket));
                  }}
                >
                  {chip.icon}
                  {chip.iconOnly ? null : ` ${chip.label}`}
                </button>
              );
            })}
          </fieldset>
        ))}
        {extra.length > 0 && (
          <fieldset className="filter-palette">
            <legend>From charts</legend>
            {extra.map((chip) => (
              <button
                key={chip.bucket}
                type="button"
                className="chip filter-chip"
                data-state={chip.not ? "without" : "with"}
                aria-label={`Remove ${chip.not ? "not " : ""}${labelOf(chip)}`}
                onClick={() => {
                  setChips(chips.filter((entry) => entry.bucket !== chip.bucket));
                }}
              >
                {chipIcon(chip)} {labelOf(chip)} ×
              </button>
            ))}
          </fieldset>
        )}
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
          <button type="submit" className="primary" disabled={name === ""}>
            {isNew ? "Add to dashboard" : "Save"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
