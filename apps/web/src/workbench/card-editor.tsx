import type { CardPatch, Section, WorkbenchCard } from "@repo/cube/browser";
import { CARD_STATUSES } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { sendPatch } from "./api.ts";
import { useCardEdit } from "./edits.ts";

const NOTES_DEBOUNCE_MS = 600;

type Save = (label: string, patch: CardPatch, undo: CardPatch) => void;

function NotesField({ slug, notes, save }: { slug: string; notes: string; save: Save }): ReactNode {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const before = useRef<string | undefined>(undefined);
  const latest = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveRef = useRef(save);
  saveRef.current = save;

  function flush(): void {
    clearTimeout(timer.current);
    const start = before.current;
    const value = latest.current;
    before.current = undefined;
    if (start !== undefined && value !== undefined && value !== start) {
      saveRef.current("notes", { notes: value }, { notes: start });
    }
  }

  useEffect(() => {
    function persistOnExit(): void {
      clearTimeout(timer.current);
      const value = latest.current;
      if (before.current !== undefined && value !== undefined && value !== before.current) {
        before.current = undefined;
        void sendPatch(slug, { notes: value }, true).catch(() => undefined);
      }
    }
    window.addEventListener("pagehide", persistOnExit);
    return () => {
      window.removeEventListener("pagehide", persistOnExit);
      flush();
    };
  }, [slug]);

  return (
    <label className="field">
      Notes
      <textarea
        aria-label="Notes"
        rows={6}
        value={draft ?? notes}
        onChange={(event) => {
          const value = event.target.value;
          before.current ??= draft ?? notes;
          latest.current = value;
          setDraft(value);
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, NOTES_DEBOUNCE_MS);
        }}
        onBlur={() => {
          flush();
          setDraft(undefined);
        }}
      />
    </label>
  );
}

function TagsField({ tags, save }: { tags: string[]; save: Save }): ReactNode {
  const [input, setInput] = useState("");
  return (
    <fieldset className="field">
      <legend>Tags</legend>
      <ul className="chips">
        {tags.map((tag) => (
          <li key={tag} className="chip">
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => {
                save("tags", { removeTags: [tag] }, { addTags: [tag] });
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="inline"
        onSubmit={(event) => {
          event.preventDefault();
          const tag = input.trim();
          setInput("");
          if (tag && !tags.includes(tag)) {
            save("tags", { addTags: [tag] }, { removeTags: [tag] });
          }
        }}
      >
        <input
          aria-label="New tag"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
          }}
          placeholder="add a tag"
        />
        <button type="submit">Add tag</button>
      </form>
    </fieldset>
  );
}

export function CardEditor({
  card,
  sections,
}: {
  card: WorkbenchCard;
  sections: Section[];
}): ReactNode {
  const edit = useCardEdit();
  const save: Save = (label, patch, undo) => {
    edit.mutate({ slug: card.slug, label, patch, undo });
  };

  return (
    <div className="editor">
      <fieldset className="field">
        <legend>Status</legend>
        <div className="segmented">
          {CARD_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={card.status === status}
              onClick={() => {
                if (card.status !== status) {
                  save("status", { status }, { status: card.status });
                }
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="field">
        Section
        <select
          aria-label="Section"
          value={card.section ?? ""}
          onChange={(event) => {
            save(
              "section",
              { section: event.target.value || null },
              { section: card.section ?? null },
            );
          }}
        >
          <option value="">none</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </label>
      <TagsField tags={card.tags} save={save} />
      <NotesField slug={card.slug} notes={card.notes} save={save} />
    </div>
  );
}
