import type { Section, CardSort, Workbench, WorkbenchCard } from "@repo/cube/browser";
import {
  CARD_SORTS,
  addSection,
  changeSection,
  moveCard,
  putCard,
  isCardSort,
  removeSection,
  restoreSection,
  sortCards,
  takeCard,
} from "@repo/cube/browser";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { DragEvent, ReactNode } from "react";
import { useState } from "react";
import { z } from "zod";
import type { Hover } from "../strip.tsx";
import { SECTION_DRAG_TYPE, DRAG_TYPE, Preview, Strip } from "../strip.tsx";
import { useRemembered } from "../view-choices.ts";
import {
  applySectionTags,
  createSectionTag,
  editBoard,
  editBoardWithUndo,
  linkSectionTag,
  missingTags,
  unlinkSectionTag,
  useBoard,
} from "./board.ts";
import { TagPicker } from "./tag-picker.tsx";

const POOL_STATUSES = new Set(["draft", "prospect"]);
const STATUS_FILTERS = [
  { id: "all", label: "Both" },
  { id: "draft", label: "Draft" },
  { id: "prospect", label: "Prospects" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];
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
        const fromSection = event.dataTransfer.types.includes(SECTION_DRAG_TYPE);
        event.dataTransfer.dropEffect = fromSection && !event.altKey ? "move" : "copy";
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
      const from = event.dataTransfer.getData(SECTION_DRAG_TYPE);
      if (slug) {
        accept({ slug, from: from || undefined, copy: event.altKey });
      }
    },
  };
}

function nextLabel(sections: readonly Section[]): string {
  const taken = new Set(sections.map((section) => section.label.toLowerCase()));
  let index = sections.length + 1;
  while (taken.has(`section ${String(index)}`)) {
    index += 1;
  }
  return `Section ${String(index)}`;
}

function newSection(sections: readonly Section[], cards: string[] = []): Section {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, label: nextLabel(sections), cards, tags: [] };
}

function SectionLabel({ section, autoFocus }: { section: Section; autoFocus: boolean }): ReactNode {
  const [label, setLabel] = useState<string | undefined>(undefined);

  function commit(): void {
    const next = label?.trim();
    setLabel(undefined);
    if (next && next !== section.label) {
      editBoard((board) => changeSection(board, section.id, { label: next }));
    }
  }

  return (
    <input
      className="board-section-label"
      aria-label="Section name"
      value={label ?? section.label}
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

function SectionTags({ section, cube }: { section: Section; cube: Workbench }): ReactNode {
  const [open, setOpen] = useState(false);
  const byId = new Map(cube.vocabulary.map((tag) => [tag.id, tag]));
  const missing = missingTags(section, cube).length;
  return (
    <div className="board-section-tag">
      <ul className="chips board-section-chips" aria-label={`Tags for ${section.label}`}>
        {section.tags.map((id) => {
          const tag = byId.get(id);
          return (
            <li key={id} className="chip" data-kind={tag?.kind}>
              {tag?.label ?? id}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {section.tags.length === 0 ? "+ Tags" : "Edit"}
      </button>
      {section.tags.length > 0 && (
        <button
          type="button"
          disabled={missing === 0}
          title="Add the section's tags to every card in it, with Undo"
          onClick={() => {
            applySectionTags(section.id);
          }}
        >
          {missing === 0 ? "Applied" : `Apply to ${String(missing)}`}
        </button>
      )}
      {open && (
        <div
          className="board-section-tags-editor"
          role="dialog"
          aria-label={`Tags for section ${section.label}`}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !event.defaultPrevented) {
              setOpen(false);
            }
          }}
        >
          <TagPicker
            legend="Section tags"
            inputLabel={`Tag for ${section.label}`}
            tags={section.tags}
            vocabulary={cube.vocabulary}
            onAdd={(id) => {
              linkSectionTag(section.id, id);
            }}
            onRemove={(id) => {
              unlinkSectionTag(section.id, id);
            }}
            onCreate={(label, kind) => createSectionTag(section.id, label, kind)}
          />
          <p className="muted">Removing a tag here unlinks it; cards keep it.</p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function AddToSection({
  section,
  pool,
}: {
  section: Section;
  pool: readonly WorkbenchCard[];
}): ReactNode {
  const [name, setName] = useState("");
  return (
    <form
      className="board-section-add"
      onSubmit={(event) => {
        event.preventDefault();
        const wanted = name.trim().toLowerCase();
        const card = pool.find((candidate) => candidate.name.toLowerCase() === wanted);
        if (card) {
          editBoard((board) => putCard(board, section.id, card.slug));
          setName("");
        }
      }}
    >
      <input
        aria-label={`Add card to ${section.label}`}
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

function SectionBox({
  section,
  sort,
  index,
  cube,
  pool,
  fresh,
  onHover,
}: {
  section: Section;
  sort: readonly CardSort[];
  index: number;
  cube: Workbench;
  pool: readonly WorkbenchCard[];
  fresh: boolean;
  onHover: (hover: Hover | undefined) => void;
}): ReactNode {
  const drop = useDrop(({ slug, from, copy }) => {
    editBoard((board) =>
      from !== undefined && !copy
        ? moveCard(board, from, section.id, slug)
        : putCard(board, section.id, slug),
    );
  });
  const bySlug = new Map(cube.cards.map((card) => [card.slug, card]));
  const cards = sortCards(
    section.cards.flatMap((slug) => bySlug.get(slug) ?? []),
    sort,
  );
  return (
    <section
      className="board-section"
      data-section={section.id}
      aria-label={`Section ${section.label}`}
      {...drop}
    >
      <header className="board-section-head">
        <SectionLabel section={section} autoFocus={fresh} />
        <span className="column-count">{cards.length}</span>
        <button
          type="button"
          className="board-section-delete"
          aria-label={`Delete section ${section.label}`}
          onClick={() => {
            editBoardWithUndo(
              `Deleted section ${section.label}`,
              (board) => removeSection(board, section.id),
              (board) => restoreSection(board, section, index),
            );
          }}
        >
          ×
        </button>
      </header>
      <SectionTags section={section} cube={cube} />
      <ul className="stack board-section-cards">
        {cards.map((card) => (
          <Strip
            key={card.slug}
            card={card}
            onHover={onHover}
            dragFrom={section.id}
            after={
              <button
                type="button"
                className="strip-remove"
                aria-label={`Take ${card.name} out of ${section.label}`}
                onClick={() => {
                  editBoard((board) => takeCard(board, section.id, card.slug));
                }}
              >
                ×
              </button>
            }
          />
        ))}
      </ul>
      <AddToSection section={section} pool={pool} />
    </section>
  );
}

function Pool({
  pool,
  placed,
  onHover,
}: {
  pool: readonly WorkbenchCard[];
  placed: ReadonlySet<string>;
  onHover: (hover: Hover | undefined) => void;
}): ReactNode {
  const [filter, setFilter] = useRemembered("board.poolFilter", "", z.string());
  const [loose, setLoose] = useRemembered("board.poolLoose", false, z.boolean());
  const [status, setStatus] = useRemembered<StatusFilter>(
    "board.poolStatus",
    "all",
    z.enum(STATUS_FILTERS.map((option) => option.id)),
  );
  const drop = useDrop(({ slug, from }) => {
    if (from !== undefined) {
      editBoard((board) => takeCard(board, from, slug));
    }
  });
  const wanted = filter.trim().toLowerCase();
  const shown = pool.filter(
    (card) =>
      card.name.toLowerCase().includes(wanted) &&
      (status === "all" || card.status === status) &&
      !(loose && placed.has(card.slug)),
  );
  return (
    <aside className="pool" aria-label="Card pool" {...drop}>
      <div className="pool-tools">
        <div className="pool-head">
          <input
            type="search"
            aria-label="Filter cards"
            placeholder="Filter cards…"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
            }}
          />
          <span className="column-count" data-testid="pool-count">
            {shown.length}
          </span>
        </div>
        <div className="pool-filters">
          <div className="segmented" role="group" aria-label="Status">
            {STATUS_FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === status}
                onClick={() => {
                  setStatus(option.id);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="pool-loose"
            aria-pressed={loose}
            title="Only cards in no section"
            onClick={() => {
              setLoose(!loose);
            }}
          >
            No section
          </button>
        </div>
      </div>
      <ul className="stack pool-cards">
        {shown.map((card) => (
          <Strip key={card.slug} card={card} onHover={onHover} />
        ))}
      </ul>
    </aside>
  );
}

function NewSection({
  sections,
  onCreate,
}: {
  sections: readonly Section[];
  onCreate: (id: string) => void;
}): ReactNode {
  const create = (cards: string[]): void => {
    const section = newSection(sections, cards);
    editBoard((board) => addSection(board, section));
    onCreate(section.id);
  };
  const drop = useDrop(({ slug, from, copy }) => {
    const section = newSection(sections, [slug]);
    editBoard((board) => {
      const added = addSection(board, section);
      return from !== undefined && !copy ? takeCard(added, from, slug) : added;
    });
  });
  return (
    <button
      type="button"
      className="board-section board-section-new"
      onClick={() => {
        create([]);
      }}
      {...drop}
    >
      + New section
      <span className="muted">or drop a card here</span>
    </button>
  );
}

const NO_SORT = "";

function parseSort(param: string | undefined): CardSort[] {
  return (param ?? "").split(".").filter(isCardSort).slice(0, 2);
}

function SortPicker({ sort }: { sort: readonly CardSort[] }): ReactNode {
  const navigate = useNavigate();
  const [first = "added", second] = sort;
  const choose = (keys: string[]): void => {
    const kept = keys.filter((key) => key !== NO_SORT);
    void navigate({
      to: "/board",
      search: (prev) => ({
        ...prev,
        sort: kept.length === 0 || kept[0] === "added" ? undefined : kept.join("."),
      }),
    });
  };
  return (
    <div className="board-sort" role="group" aria-label="Sort cards">
      <label>
        Sort cards by{" "}
        <select
          aria-label="Sort cards by"
          value={first}
          onChange={(event) => {
            choose([event.target.value, second ?? NO_SORT]);
          }}
        >
          {CARD_SORTS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        then{" "}
        <select
          aria-label="Then by"
          value={second ?? NO_SORT}
          disabled={first === "added"}
          onChange={(event) => {
            choose([first, event.target.value]);
          }}
        >
          <option value={NO_SORT}>—</option>
          {CARD_SORTS.filter((option) => option.id !== "added" && option.id !== first).map(
            (option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ),
          )}
        </select>
      </label>
    </div>
  );
}

export function BoardPage({ cube }: { cube: Workbench | undefined }): ReactNode {
  const { board, error } = useBoard();
  const sort = parseSort(useSearch({ from: "/board" }).sort);
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
  const pool = sortCards(
    cube.cards
      .filter((card) => POOL_STATUSES.has(card.status))
      .sort((a, b) => a.name.localeCompare(b.name)),
    sort,
  );
  const placed = new Set(board.sections.flatMap((section) => section.cards));
  return (
    <div className="board">
      <div className="board-top">
        <ul className="board-help" aria-label="Board controls">
          <li>
            <strong>Drag in</strong> adds a card (it can sit in several sections)
          </li>
          <li>
            <strong>Between sections</strong> moves, <kbd>⌥ Alt</kbd> copies
          </li>
          <li>
            <strong>Back to the pool</strong> takes it out
          </li>
          <li>
            <strong>Onto New section</strong> starts a section
          </li>
          <li>
            <strong>Apply</strong> adds a section&apos;s tags to every card, with Undo
          </li>
        </ul>
        <SortPicker sort={sort} />
      </div>
      <Pool pool={pool} placed={placed} onHover={setHover} />
      <div className="board-sections">
        {board.sections.map((section, index) => (
          <SectionBox
            key={section.id}
            section={section}
            sort={sort}
            index={index}
            cube={cube}
            pool={pool}
            fresh={section.id === fresh}
            onHover={setHover}
          />
        ))}
        <NewSection sections={board.sections} onCreate={setFresh} />
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
