import type { CardPatch, Section, Tag, WorkbenchCard } from "@repo/cube/browser";
import { CARD_STATUSES, TAG_KINDS } from "@repo/cube/browser";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { sendChanges } from "./api.ts";
import { useCardEdit } from "./edits.ts";
import { findTag, useCreateTag } from "./tags.ts";

const NOTES_DEBOUNCE_MS = 600;
const MAX_SUGGESTIONS = 12;

type Save = (label: string, patch: CardPatch, undo: CardPatch) => void;

function NotesField({ slug, notes, save }: { slug: string; notes: string; save: Save }): ReactNode {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const before = useRef<string | undefined>(undefined);
  const latest = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  }, [save]);

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
        void sendChanges([{ slug, patch: { notes: value } }], true).catch(() => undefined);
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

function focusOnMount(element: HTMLButtonElement | null): void {
  element?.focus();
}

function TagsField({
  slug,
  tags,
  vocabulary,
  save,
}: {
  slug: string;
  tags: string[];
  vocabulary: Tag[];
  save: Save;
}): ReactNode {
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState<string | undefined>(undefined);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const createTag = useCreateTag();

  function closeCreate(): void {
    setCreating(undefined);
    inputRef.current?.focus();
  }
  const byId = new Map(vocabulary.map((tag) => [tag.id, tag]));
  const query = input.trim().toLowerCase();
  const suggestions = vocabulary
    .filter((tag) => !tags.includes(tag.id))
    .filter((tag) => tag.label.toLowerCase().includes(query) || tag.id.includes(query))
    .slice(0, MAX_SUGGESTIONS);
  const current = active < suggestions.length ? active : -1;
  const optionId = (index: number): string => `${listId}-${String(index)}`;

  function pick(tag: Tag): void {
    setInput("");
    setCreating(undefined);
    setActive(-1);
    add(tag.id);
  }

  function add(id: string): void {
    if (!tags.includes(id)) {
      save("tags", { addTags: [id] }, { removeTags: [id] });
    }
  }

  return (
    <fieldset className="field">
      <legend>Tags</legend>
      <ul className="chips">
        {tags.map((id) => {
          const tag = byId.get(id);
          const label = tag?.label ?? id;
          return (
            <li key={id} className="chip" data-kind={tag?.kind}>
              {label}
              <button
                type="button"
                aria-label={`Remove tag ${label}`}
                onClick={() => {
                  save("tags", { removeTags: [id] }, { addTags: [id] });
                }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="inline"
        onSubmit={(event) => {
          event.preventDefault();
          const text = input.trim();
          if (!text) {
            return;
          }
          const known = findTag(vocabulary, text);
          if (known) {
            setInput("");
            setCreating(undefined);
            add(known.id);
          } else {
            setCreating(text);
          }
        }}
      >
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Tag name"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-activedescendant={current >= 0 ? optionId(current) : undefined}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setCreating(undefined);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            const count = suggestions.length;
            if (event.key === "ArrowDown" && count > 0) {
              event.preventDefault();
              setActive((current + 1) % count);
            } else if (event.key === "ArrowUp" && count > 0) {
              event.preventDefault();
              setActive(current <= 0 ? count - 1 : current - 1);
            } else if (event.key === "Enter" && current >= 0) {
              const tag = suggestions[current];
              if (tag) {
                event.preventDefault();
                pick(tag);
              }
            } else if (event.key === "Escape" && (current >= 0 || input !== "")) {
              event.preventDefault();
              setActive(-1);
              setInput("");
            }
          }}
          placeholder="pick a tag"
        />
        <button type="submit">Add tag</button>
      </form>
      <ul className="suggestions" id={listId} role="listbox" aria-label="Suggested tags">
        {suggestions.map((tag, index) => (
          <li
            key={tag.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === current}
            className="suggestion"
            data-kind={tag.kind}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              pick(tag);
            }}
          >
            + {tag.label}
          </li>
        ))}
      </ul>
      <div aria-live="polite">
        {creating !== undefined && (
          <div className="create-tag" role="group" aria-label="Create tag">
            <span>&ldquo;{creating}&rdquo; is not a tag yet.</span>
            {TAG_KINDS.map((kind, index) => (
              <button
                key={kind}
                ref={index === 0 ? focusOnMount : undefined}
                type="button"
                disabled={createTag.isPending}
                onClick={() => {
                  createTag.mutate(
                    { label: creating, kind, addTo: slug },
                    {
                      onSuccess: () => {
                        setInput("");
                        closeCreate();
                      },
                    },
                  );
                }}
              >
                Create as {kind}
              </button>
            ))}
            <button type="button" onClick={closeCreate}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </fieldset>
  );
}

export function CardEditor({
  card,
  sections,
  vocabulary,
}: {
  card: WorkbenchCard;
  sections: Section[];
  vocabulary: Tag[];
}): ReactNode {
  const edit = useCardEdit();
  const save: Save = (label, patch, undo) => {
    edit.mutate({
      label,
      changes: [{ slug: card.slug, patch }],
      undo: [{ slug: card.slug, patch: undo }],
    });
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
      {card.status !== "cut" && (
        <Link to="/add" search={{ replaces: card.slug }}>
          Swap for another card…
        </Link>
      )}
      <TagsField slug={card.slug} tags={card.tags} vocabulary={vocabulary} save={save} />
      <NotesField slug={card.slug} notes={card.notes} save={save} />
    </div>
  );
}
