import type { CardChange, CardPatch, Workbench, WorkbenchCard } from "@repo/cube/browser";
import { CARD_STATUSES } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useState } from "react";
import { ORGANIZE_ID } from "../grid/piles.ts";
import { useCardEdit } from "./edits.ts";
import { clearSelection, setSelected, useSelection } from "./selection.ts";
import { showToast } from "./toast.tsx";

const NO_SECTION = "__none";

type Choose = (card: WorkbenchCard) => [CardPatch, CardPatch] | undefined;

export function SelectCard({ slug, name }: { slug: string; name: string }): ReactNode {
  const selected = useSelection().has(slug);
  return (
    <input
      type="checkbox"
      className="select"
      aria-label={`Select ${name}`}
      checked={selected}
      onChange={(event) => {
        setSelected([slug], event.target.checked);
      }}
    />
  );
}

export function SelectPile({ slugs, label }: { slugs: string[]; label: string }): ReactNode {
  const selection = useSelection();
  const all = slugs.length > 0 && slugs.every((slug) => selection.has(slug));
  const some = !all && slugs.some((slug) => selection.has(slug));
  return (
    <input
      ref={(element) => {
        if (element) {
          element.indeterminate = some;
        }
      }}
      type="checkbox"
      className="select-pile"
      aria-label={`Select all in ${label}`}
      checked={all}
      disabled={slugs.length === 0}
      onChange={(event) => {
        setSelected(slugs, event.target.checked);
      }}
    />
  );
}

interface Option {
  value: string;
  label: string;
}

function ApplySelect({
  label,
  placeholder,
  options,
  onApply,
}: {
  label: string;
  placeholder: string;
  options: Option[];
  onApply: (value: string) => void;
}): ReactNode {
  const [value, setValue] = useState("");
  return (
    <form
      className="inline"
      onSubmit={(event) => {
        event.preventDefault();
        if (value) {
          onApply(value);
          setValue("");
        }
      }}
    >
      <select
        aria-label={label}
        value={value}
        disabled={options.length === 0}
        onChange={(event) => {
          setValue(event.target.value);
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={!value} aria-label={`Apply ${label.toLowerCase()}`}>
        Apply
      </button>
    </form>
  );
}

function plural(count: number): string {
  return `${String(count)} card${count === 1 ? "" : "s"}`;
}

export function BulkBar({ cube }: { cube: Workbench | undefined }): ReactNode {
  const selection = useSelection();
  const edit = useCardEdit();
  const cards = cube?.cards.filter((card) => selection.has(card.slug)) ?? [];
  if (!cube || cards.length === 0) {
    return null;
  }
  const present = cube.vocabulary.filter((tag) => cards.some((card) => card.tags.includes(tag.id)));

  function bulk(what: string, pick: Choose): void {
    const changes: CardChange[] = [];
    const undo: CardChange[] = [];
    for (const card of cards) {
      const picked = pick(card);
      if (picked) {
        changes.push({ slug: card.slug, patch: picked[0] });
        undo.push({ slug: card.slug, patch: picked[1] });
      }
    }
    if (changes.length === 0) {
      showToast({ message: `No selected card needs ${what}`, tone: "info" });
      return;
    }
    edit.mutate({ label: `${what} on ${plural(changes.length)}`, changes, undo });
  }

  return (
    <div className="bulk-bar" role="toolbar" aria-label="Bulk edit">
      <strong data-testid="selected-count">{cards.length} selected</strong>
      {CARD_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => {
            bulk(`status ${status}`, (card) =>
              card.status === status ? undefined : [{ status }, { status: card.status }],
            );
          }}
        >
          Set {status}
        </button>
      ))}
      <ApplySelect
        label="Move to section"
        placeholder="Move to section…"
        options={[
          ...cube.sections.map((section) => ({ value: section.id, label: section.label })),
          { value: NO_SECTION, label: "none" },
        ]}
        onApply={(value) => {
          const section = value === NO_SECTION ? null : value;
          bulk(`section ${section ?? "none"}`, (card) =>
            (card.section ?? null) === section
              ? undefined
              : [{ section }, { section: card.section ?? null }],
          );
        }}
      />
      <ApplySelect
        label="Add tag to selected"
        placeholder="Add tag…"
        options={cube.vocabulary.map((tag) => ({ value: tag.id, label: tag.label }))}
        onApply={(id) => {
          bulk(`tag ${id}`, (card) =>
            card.tags.includes(id) ? undefined : [{ addTags: [id] }, { removeTags: [id] }],
          );
        }}
      />
      <ApplySelect
        label="Remove tag from selected"
        placeholder="Remove tag…"
        options={present.map((tag) => ({ value: tag.id, label: tag.label }))}
        onApply={(id) => {
          bulk(`untag ${id}`, (card) =>
            card.tags.includes(id) ? [{ removeTags: [id] }, { addTags: [id] }] : undefined,
          );
        }}
      />
      <button
        type="button"
        onClick={() => {
          clearSelection();
          document.getElementById(ORGANIZE_ID)?.focus();
        }}
      >
        Clear selection
      </button>
    </div>
  );
}
