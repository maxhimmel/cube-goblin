import type { Bin, TagKind, Workbench, WorkbenchCard } from "@repo/cube/browser";
import {
  TAG_KINDS,
  addBin,
  changeBin,
  moveCard,
  putCard,
  removeBin,
  restoreBin,
  takeCard,
} from "@repo/cube/browser";
import type { DragEvent, ReactNode } from "react";
import { useState } from "react";
import type { Hover } from "../strip.tsx";
import { BIN_DRAG_TYPE, DRAG_TYPE, Preview, Strip } from "../strip.tsx";
import { editBoard, editBoardWithUndo, promoteBin, untagged, useBoard } from "./board.ts";
import { findTag } from "./tags.ts";

const POOL_STATUSES = new Set(["draft", "prospect"]);
const POOL_LIST_ID = "board-pool-names";

interface Dropped {
  slug: string;
  from: string | undefined;
  copy: boolean;
}

interface DropTarget {
  "data-drop": string | undefined;
  onDragOver: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
}

function useDrop(accept: (dropped: Dropped) => void): DropTarget {
  const [over, setOver] = useState(false);
  return {
    "data-drop": over ? "over" : undefined,
    onDragOver: (event) => {
      if (event.dataTransfer.types.includes(DRAG_TYPE)) {
        event.preventDefault();
        const fromBin = event.dataTransfer.types.includes(BIN_DRAG_TYPE);
        event.dataTransfer.dropEffect = fromBin && !event.altKey ? "move" : "copy";
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
      event.stopPropagation();
      setOver(false);
      const slug = event.dataTransfer.getData(DRAG_TYPE);
      const from = event.dataTransfer.getData(BIN_DRAG_TYPE);
      if (slug) {
        accept({ slug, from: from || undefined, copy: event.altKey });
      }
    },
  };
}

function nextLabel(bins: readonly Bin[]): string {
  const taken = new Set(bins.map((bin) => bin.label.toLowerCase()));
  let index = bins.length + 1;
  while (taken.has(`bin ${String(index)}`)) {
    index += 1;
  }
  return `Bin ${String(index)}`;
}

function newBin(bins: readonly Bin[], cards: string[] = []): Bin {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, label: nextLabel(bins), cards };
}

function BinLabel({ bin, autoFocus }: { bin: Bin; autoFocus: boolean }): ReactNode {
  const [label, setLabel] = useState<string | undefined>(undefined);

  function commit(): void {
    const next = label?.trim();
    setLabel(undefined);
    if (next && next !== bin.label) {
      editBoard((board) => changeBin(board, bin.id, { label: next }));
    }
  }

  return (
    <input
      className="bin-label"
      aria-label="Bin name"
      value={label ?? bin.label}
      autoFocus={autoFocus}
      onFocus={(event) => {
        event.currentTarget.select();
      }}
      onChange={(event) => {
        setLabel(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setLabel(undefined);
        }
      }}
    />
  );
}

function BinTag({ bin, cube }: { bin: Bin; cube: Workbench }): ReactNode {
  const [kind, setKind] = useState<TagKind>("group");
  const linked = cube.vocabulary.find((tag) => tag.id === bin.tag);
  const known = linked ?? findTag(cube.vocabulary, bin.label);
  const missing = linked ? untagged(bin, cube).length : bin.cards.length;
  const promote = (): void => {
    void promoteBin(bin.id, kind);
  };
  if (linked) {
    return (
      <div className="bin-tag">
        <span className="chip" data-kind={linked.kind}>
          tag · {linked.label}
        </span>
        {missing > 0 && (
          <button type="button" onClick={promote}>
            Tag {missing} more
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="bin-tag">
      {known ? (
        <span className="muted">Tag {known.label} exists</span>
      ) : (
        <select
          aria-label={`Tag kind for ${bin.label}`}
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as TagKind);
          }}
        >
          {TAG_KINDS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
      <button type="button" disabled={bin.cards.length === 0} onClick={promote}>
        {known ? `Tag cards ${known.label}` : "Make tag"}
      </button>
    </div>
  );
}

function AddToBin({ bin, pool }: { bin: Bin; pool: readonly WorkbenchCard[] }): ReactNode {
  const [name, setName] = useState("");
  return (
    <form
      className="bin-add"
      onSubmit={(event) => {
        event.preventDefault();
        const wanted = name.trim().toLowerCase();
        const card = pool.find((candidate) => candidate.name.toLowerCase() === wanted);
        if (card) {
          editBoard((board) => putCard(board, bin.id, card.slug));
          setName("");
        }
      }}
    >
      <input
        aria-label={`Add card to ${bin.label}`}
        placeholder="Add card…"
        list={POOL_LIST_ID}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
    </form>
  );
}

function BinBox({
  bin,
  index,
  cube,
  pool,
  fresh,
  onHover,
}: {
  bin: Bin;
  index: number;
  cube: Workbench;
  pool: readonly WorkbenchCard[];
  fresh: boolean;
  onHover: (hover: Hover | undefined) => void;
}): ReactNode {
  const drop = useDrop(({ slug, from, copy }) => {
    editBoard((board) =>
      from !== undefined && !copy
        ? moveCard(board, from, bin.id, slug)
        : putCard(board, bin.id, slug),
    );
  });
  const bySlug = new Map(cube.cards.map((card) => [card.slug, card]));
  const cards = bin.cards.flatMap((slug) => bySlug.get(slug) ?? []);
  return (
    <section className="bin" data-bin={bin.id} aria-label={`Bin ${bin.label}`} {...drop}>
      <header className="bin-head">
        <BinLabel bin={bin} autoFocus={fresh} />
        <span className="column-count">{cards.length}</span>
        <button
          type="button"
          className="bin-delete"
          aria-label={`Delete bin ${bin.label}`}
          onClick={() => {
            editBoardWithUndo(
              `Deleted bin ${bin.label}`,
              (board) => removeBin(board, bin.id),
              (board) => restoreBin(board, bin, index),
            );
          }}
        >
          ×
        </button>
      </header>
      <BinTag bin={bin} cube={cube} />
      <ul className="stack bin-cards">
        {cards.map((card) => (
          <Strip
            key={card.slug}
            card={card}
            onHover={onHover}
            dragFrom={bin.id}
            after={
              <button
                type="button"
                className="strip-remove"
                aria-label={`Take ${card.name} out of ${bin.label}`}
                onClick={() => {
                  editBoard((board) => takeCard(board, bin.id, card.slug));
                }}
              >
                ×
              </button>
            }
          />
        ))}
      </ul>
      <AddToBin bin={bin} pool={pool} />
    </section>
  );
}

function Pool({
  pool,
  binned,
  onHover,
}: {
  pool: readonly WorkbenchCard[];
  binned: ReadonlySet<string>;
  onHover: (hover: Hover | undefined) => void;
}): ReactNode {
  const [filter, setFilter] = useState("");
  const [loose, setLoose] = useState(false);
  const drop = useDrop(({ slug, from }) => {
    if (from !== undefined) {
      editBoard((board) => takeCard(board, from, slug));
    }
  });
  const wanted = filter.trim().toLowerCase();
  const shown = pool.filter(
    (card) => card.name.toLowerCase().includes(wanted) && !(loose && binned.has(card.slug)),
  );
  return (
    <aside className="pool" aria-label="Card pool" {...drop}>
      <div className="pool-tools">
        <input
          type="search"
          aria-label="Filter cards"
          placeholder="Filter cards…"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
          }}
        />
        <label>
          <input
            type="checkbox"
            checked={loose}
            onChange={(event) => {
              setLoose(event.target.checked);
            }}
          />{" "}
          Only cards in no bin
        </label>
        <span className="muted" data-testid="pool-count">
          {shown.length} cards
        </span>
      </div>
      <ul className="stack pool-cards">
        {shown.map((card) => (
          <Strip key={card.slug} card={card} onHover={onHover} />
        ))}
      </ul>
    </aside>
  );
}

function NewBin({
  bins,
  onCreate,
}: {
  bins: readonly Bin[];
  onCreate: (id: string) => void;
}): ReactNode {
  const create = (cards: string[]): void => {
    const bin = newBin(bins, cards);
    editBoard((board) => addBin(board, bin));
    onCreate(bin.id);
  };
  const drop = useDrop(({ slug, from, copy }) => {
    const bin = newBin(bins, [slug]);
    editBoard((board) => {
      const added = addBin(board, bin);
      return from !== undefined && !copy ? takeCard(added, from, slug) : added;
    });
  });
  return (
    <button
      type="button"
      className="bin bin-new"
      onClick={() => {
        create([]);
      }}
      {...drop}
    >
      + New bin
      <span className="muted">or drop a card here</span>
    </button>
  );
}

export function BoardPage({ cube }: { cube: Workbench | undefined }): ReactNode {
  const { board, error } = useBoard();
  const [hover, setHover] = useState<Hover | undefined>(undefined);
  const [fresh, setFresh] = useState<string | undefined>(undefined);
  if (error) {
    return (
      <p role="alert" className="error">
        {error.message}
      </p>
    );
  }
  if (!cube || !board) {
    return <p className="muted">Loading board…</p>;
  }
  const pool = cube.cards
    .filter((card) => POOL_STATUSES.has(card.status))
    .sort((a, b) => a.name.localeCompare(b.name));
  const binned = new Set(board.bins.flatMap((bin) => bin.cards));
  return (
    <div className="board">
      <Pool pool={pool} binned={binned} onHover={setHover} />
      <div className="bins">
        {board.bins.map((bin, index) => (
          <BinBox
            key={bin.id}
            bin={bin}
            index={index}
            cube={cube}
            pool={pool}
            fresh={bin.id === fresh}
            onHover={setHover}
          />
        ))}
        <NewBin bins={board.bins} onCreate={setFresh} />
      </div>
      <datalist id={POOL_LIST_ID}>
        {pool.map((card) => (
          <option key={card.slug} value={card.name} />
        ))}
      </datalist>
      <Preview hover={hover} />
    </div>
  );
}
