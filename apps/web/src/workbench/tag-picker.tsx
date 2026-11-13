import type { Tag } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useId, useRef, useState } from "react";
import { findTag } from "./tags.ts";

const MAX_SUGGESTIONS = 12;

function focusOnMount(element: HTMLButtonElement | null): void {
  element?.focus();
}

export function TagPicker({
  legend,
  inputLabel,
  tags,
  vocabulary,
  onAdd,
  onRemove,
  onCreate,
}: {
  legend: string;
  inputLabel: string;
  tags: readonly string[];
  vocabulary: readonly Tag[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onCreate: (label: string) => Promise<unknown>;
}): ReactNode {
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState<string | undefined>(undefined);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

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
      onAdd(id);
    }
  }

  return (
    <fieldset className="field">
      <legend>{legend}</legend>
      <ul className="chips">
        {tags.map((id) => {
          const tag = byId.get(id);
          const label = tag?.label ?? id;
          return (
            <li key={id} className="chip">
              {label}
              <button
                type="button"
                aria-label={`Remove tag ${label}`}
                onClick={() => {
                  onRemove(id);
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
          aria-label={inputLabel}
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
            <button
              ref={focusOnMount}
              type="button"
              disabled={pending}
              onClick={() => {
                setPending(true);
                onCreate(creating).then(
                  () => {
                    setPending(false);
                    setInput("");
                    closeCreate();
                  },
                  () => {
                    setPending(false);
                  },
                );
              }}
            >
              Create tag
            </button>
            <button type="button" onClick={closeCreate}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </fieldset>
  );
}
