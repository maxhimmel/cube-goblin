import type { CardChange, CardPatch, Workbench, WorkbenchCard } from "@repo/cube/browser";
import { CARD_STATUSES } from "@repo/cube/browser";
import type { ReactNode } from "react";
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
  return (
    <input
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

function plural(count: number): string {
  return `${String(count)} card${count === 1 ? "" : "s"}`;
}

export function BulkBar({ cube }: { cube: Workbench | undefined }): ReactNode {
  const selection = useSelection();
  const edit = useCardEdit();
  if (!cube || selection.size === 0) {
    return null;
  }
  const cards = cube.cards.filter((card) => selection.has(card.slug));
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
      <strong data-testid="selected-count">{selection.size} selected</strong>
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
      <select
        aria-label="Move to section"
        value=""
        onChange={(event) => {
          const value = event.target.value;
          const section = value === NO_SECTION ? null : value;
          bulk(`section ${section ?? "none"}`, (card) =>
            (card.section ?? null) === section
              ? undefined
              : [{ section }, { section: card.section ?? null }],
          );
        }}
      >
        <option value="" disabled>
          Move to section…
        </option>
        {cube.sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.label}
          </option>
        ))}
        <option value={NO_SECTION}>none</option>
      </select>
      <select
        aria-label="Add tag to selected"
        value=""
        disabled={cube.vocabulary.length === 0}
        onChange={(event) => {
          const id = event.target.value;
          bulk(`tag ${id}`, (card) =>
            card.tags.includes(id) ? undefined : [{ addTags: [id] }, { removeTags: [id] }],
          );
        }}
      >
        <option value="" disabled>
          Add tag…
        </option>
        {cube.vocabulary.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Remove tag from selected"
        value=""
        disabled={present.length === 0}
        onChange={(event) => {
          const id = event.target.value;
          bulk(`untag ${id}`, (card) =>
            card.tags.includes(id) ? [{ removeTags: [id] }, { addTags: [id] }] : undefined,
          );
        }}
      >
        <option value="" disabled>
          Remove tag…
        </option>
        {present.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={clearSelection}>
        Clear selection
      </button>
    </div>
  );
}
