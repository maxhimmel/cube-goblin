import type { Keyword, Operator, QueryPart, Tag } from "@repo/cube/browser";
import {
  KEYWORDS,
  SYNTAX,
  compileQuery,
  joinQuery,
  keyword,
  queryParts,
  removePart,
  term,
} from "@repo/cube/browser";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

interface Suggestion {
  text: string;
  label: string;
  hint?: string | undefined;
  complete: boolean;
}

const TERM_SHAPE = /^(-?)([a-z]*)(!=|<=|>=|:|=|<|>)?(.*)$/iu;

function valuesFor(entry: Keyword, vocabulary: readonly Tag[]): { value: string; hint?: string }[] {
  if (entry.kind === "tag") {
    return vocabulary.map((tag) => ({ value: tag.id, hint: tag.label }));
  }
  if (entry.kind === "number") {
    return KEYWORDS.filter((other) => other.kind === "number" && other.name !== entry.name).map(
      (other) => ({ value: other.name, hint: `compare with ${other.help.toLowerCase()}` }),
    );
  }
  return (entry.values ?? []).map((value) => ({ value }));
}

export function suggest(token: string, vocabulary: readonly Tag[]): Suggestion[] {
  const shape = TERM_SHAPE.exec(token);
  if (!shape || token === "" || token === "-") {
    return [];
  }
  const [, not = "", field = "", op, value = ""] = shape;
  const lowerField = field.toLowerCase();
  if (op === undefined) {
    const keywords = KEYWORDS.filter(
      (entry) =>
        entry.name.startsWith(lowerField) ||
        entry.aliases.some((alias) => alias.startsWith(lowerField)),
    ).map((entry) => ({
      text: `${not}${entry.name}${entry.operators[0] ?? ":"}`,
      label: `${not}${entry.name}${entry.operators[0] ?? ":"}`,
      hint: entry.help,
      complete: false,
    }));
    const tags = vocabulary
      .filter(
        (tag) => tag.id.startsWith(lowerField) || tag.label.toLowerCase().startsWith(lowerField),
      )
      .map((tag) => ({
        text: `${not}tag:${tag.id}`,
        label: `${not}tag:${tag.id}`,
        hint: tag.label,
        complete: true,
      }));
    return [...keywords, ...tags].slice(0, 8);
  }
  const entry = keyword(lowerField);
  if (!entry) {
    return [];
  }
  const lowerValue = value.toLowerCase();
  return valuesFor(entry, vocabulary)
    .filter((option) => option.value.startsWith(lowerValue) && option.value !== lowerValue)
    .slice(0, 8)
    .map((option) => ({
      text: `${not}${entry.name}${op}${option.value}`,
      label: `${not}${entry.name}${op}${option.value}`,
      hint: option.hint,
      complete: true,
    }));
}

function lastToken(draft: string): string {
  return /(\S*)$/u.exec(draft)?.[1] ?? "";
}

function replaceLast(draft: string, next: string): string {
  return draft.slice(0, draft.length - lastToken(draft).length) + next;
}

function Legend({ onPick }: { onPick: (text: string) => void }): ReactNode {
  return (
    <div className="query-legend" role="dialog" aria-label="Query syntax">
      <table>
        <tbody>
          {KEYWORDS.map((entry) => (
            <tr key={entry.name}>
              <th scope="row">
                <code>{[entry.name, ...entry.aliases].join(" ")}</code>
              </th>
              <td>{entry.help}</td>
              <td>
                <button
                  type="button"
                  className="query-example"
                  onClick={() => {
                    onPick(entry.example);
                  }}
                >
                  {entry.example}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table>
        <tbody>
          {SYNTAX.map((row) => (
            <tr key={row.syntax}>
              <th scope="row">
                <code>{row.syntax}</code>
              </th>
              <td>{row.help}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Numbers take <code>= != &lt; &lt;= &gt; &gt;=</code>. Tab accepts a suggestion; Backspace in
        an empty box edits the last part; <kbd>/</kbd> jumps here.
      </p>
    </div>
  );
}

interface PickerState {
  field?: Keyword | undefined;
  op?: Operator | undefined;
  value: string;
  not: boolean;
}

function startFor(part: QueryPart | undefined): PickerState {
  const shape = part ? TERM_SHAPE.exec(part.text) : null;
  const entry = shape?.[2] ? keyword(shape[2]) : undefined;
  if (!part || part.kind === "group" || !shape || !entry) {
    return {
      value: "",
      not: part?.text.startsWith("-") ?? false,
      ...(part && !entry ? { field: keyword("name"), op: ":" as const, value: part.text } : {}),
    };
  }
  const op = (shape[3] ?? ":") as Operator;
  return { field: entry, op, value: (shape[4] ?? "").replaceAll('"', ""), not: shape[1] === "-" };
}

function Picker({
  vocabulary,
  start,
  onDone,
  onClose,
}: {
  vocabulary: readonly Tag[];
  start: PickerState;
  onDone: (text: string) => void;
  onClose: () => void;
}): ReactNode {
  const [state, setState] = useState<PickerState>(start);
  const { field, op, value, not } = state;
  const preview =
    field && op && value !== "" ? `${not ? "-" : ""}${term(field.name, op, value)}` : undefined;
  const valid = preview !== undefined && compileQuery(preview).ok;
  const options = field ? valuesFor(field, vocabulary) : [];
  return (
    <div className="query-picker" role="dialog" aria-label="Add a filter part">
      {!field ? (
        <ul className="query-picker-fields">
          {KEYWORDS.map((entry) => (
            <li key={entry.name}>
              <button
                type="button"
                onClick={() => {
                  setState({ ...state, field: entry, op: entry.operators[0] });
                }}
              >
                <code>{entry.name}</code> <span>{entry.help}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="query-picker-body">
          <div className="query-picker-row">
            <button
              type="button"
              className="query-picker-field"
              onClick={() => {
                setState({ value: "", not });
              }}
            >
              {field.name}
            </button>
            {field.operators.map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={candidate === op}
                className="query-picker-op"
                onClick={() => {
                  setState({ ...state, op: candidate });
                }}
              >
                {candidate}
              </button>
            ))}
            <label className="query-picker-not">
              <input
                type="checkbox"
                checked={not}
                onChange={(event) => {
                  setState({ ...state, not: event.target.checked });
                }}
              />
              not
            </label>
          </div>
          <input
            className="query-picker-value"
            aria-label={`${field.name} value`}
            inputMode={field.kind === "number" ? "numeric" : "text"}
            placeholder={field.kind === "number" ? "number" : "value"}
            value={value}
            autoFocus
            onChange={(event) => {
              setState({ ...state, value: event.target.value });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && valid) {
                event.preventDefault();
                onDone(preview);
              }
            }}
          />
          {options.length > 0 && (
            <div className="query-picker-options">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={option.value === value}
                  title={option.hint}
                  onClick={() => {
                    setState({ ...state, value: option.value });
                  }}
                >
                  {option.hint && field.kind === "tag" ? option.hint : option.value}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <footer className="query-picker-foot">
        <code className="query-picker-preview">{preview ?? "…"}</code>
        <button type="button" className="query-link" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="primary"
          disabled={!valid}
          onClick={() => {
            if (preview && valid) {
              onDone(preview);
            }
          }}
        >
          {start.field ? "Update" : "Add"}
        </button>
      </footer>
    </div>
  );
}

export function QueryInput({
  initial,
  onChange,
  vocabulary,
  label,
  placeholder = "t:creature pow>=3 -c:g",
  status,
  actions,
  autoFocus = false,
  slashFocus = false,
  onSubmit,
}: {
  initial: string;
  onChange: (query: string) => void;
  vocabulary: readonly Tag[];
  label: string;
  placeholder?: string;
  status?: ReactNode;
  actions?: ReactNode;
  autoFocus?: boolean;
  slashFocus?: boolean;
  onSubmit?: (query: string) => void;
}): ReactNode {
  const [committed, setCommitted] = useState(initial);
  const [draft, setDraft] = useState("");
  const [fresh, setFresh] = useState<string | undefined>(undefined);
  const [active, setActive] = useState(0);
  const [panel, setPanel] = useState<"legend" | "picker" | undefined>(undefined);
  const [editing, setEditing] = useState<QueryPart | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!slashFocus) {
      return;
    }
    const onKey = (event: globalThis.KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.closest("input, textarea, select, [contenteditable='true']") !== null &&
        target !== null;
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [slashFocus]);

  const full = joinQuery(committed, draft);
  const result = compileQuery(full);
  const parts = queryParts(committed);
  const token = lastToken(draft);
  const suggestions = suggest(token, vocabulary);
  const top = suggestions[Math.min(active, suggestions.length - 1)];
  const ghost = top?.text.toLowerCase().startsWith(token.toLowerCase())
    ? top.text.slice(token.length)
    : "";

  const publish = (nextCommitted: string, nextDraft: string): void => {
    const next = joinQuery(nextCommitted, nextDraft);
    if (compileQuery(next).ok) {
      onChange(next);
    }
  };

  const commit = (text: string, rest = ""): void => {
    const piece = text.trim();
    if (piece === "" || !compileQuery(piece).ok) {
      setDraft(text + rest);
      publish(committed, text + rest);
      return;
    }
    const next = joinQuery(committed, piece);
    setCommitted(next);
    setDraft(rest);
    setFresh(piece);
    setActive(0);
    publish(next, rest);
  };

  const accept = (suggestion: Suggestion): void => {
    const next = replaceLast(draft, suggestion.text);
    if (suggestion.complete) {
      commit(next);
    } else {
      setDraft(next);
      publish(committed, next);
    }
    setActive(0);
    input.current?.focus();
  };

  const remove = (part: QueryPart): void => {
    const next = removePart(committed, part);
    setCommitted(next);
    publish(next, draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Tab" && top && token !== "") {
      event.preventDefault();
      accept(top);
      return;
    }
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setActive((active + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setActive((active - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (event.key === "Escape") {
      setPanel(undefined);
      setActive(0);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (draft.trim() !== "") {
        commit(draft);
      }
      if (result.ok) {
        onSubmit?.(full);
      }
      return;
    }
    if (event.key === "Backspace" && draft === "" && parts.length > 0) {
      event.preventDefault();
      const last = parts.at(-1);
      if (last) {
        const next = removePart(committed, last);
        setCommitted(next);
        setDraft(last.text);
        publish(next, last.text);
      }
    }
  };

  const balanced = (text: string): boolean =>
    (text.match(/\(/gu) ?? []).length === (text.match(/\)/gu) ?? []).length &&
    (text.match(/"/gu) ?? []).length % 2 === 0;

  return (
    <div className="query-input" data-invalid={result.ok ? undefined : ""}>
      <div
        className="query-field"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            input.current?.focus();
          }
        }}
      >
        <ul className="query-pills" aria-label={`${label} parts`}>
          {parts.map((part) => (
            <li
              key={`${String(part.start)}-${part.text}`}
              className="query-pill"
              data-kind={part.kind}
              data-not={part.text.startsWith("-") ? "" : undefined}
              data-fresh={part.text === fresh ? "" : undefined}
            >
              <button
                type="button"
                className="query-pill-text"
                title="Edit"
                onClick={() => {
                  if (part.kind === "group") {
                    remove(part);
                    setDraft(part.text);
                    input.current?.focus();
                    return;
                  }
                  setEditing(part);
                  setPanel("picker");
                }}
              >
                {part.text}
              </button>
              <button
                type="button"
                className="query-pill-remove"
                aria-label={`Remove ${part.text}`}
                onClick={() => {
                  remove(part);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <span className="query-typing">
          <span className="query-ghost" aria-hidden="true">
            <span className="query-ghost-typed">{draft}</span>
            {ghost}
          </span>
          <input
            ref={input}
            className="query-text"
            aria-label={label}
            aria-invalid={!result.ok}
            aria-autocomplete="list"
            aria-controls={listId}
            placeholder={parts.length === 0 ? placeholder : ""}
            value={draft}
            spellCheck={false}
            autoFocus={autoFocus}
            onChange={(event) => {
              const text = event.target.value;
              setActive(0);
              if (/\s$/u.test(text) && balanced(text) && compileQuery(text.trim()).ok) {
                commit(text);
                return;
              }
              setDraft(text);
              publish(committed, text);
            }}
            onKeyDown={onKeyDown}
          />
        </span>
        <span className="query-tools">
          <button
            type="button"
            className="query-tool"
            aria-expanded={panel === "picker" && editing === undefined}
            onClick={() => {
              setEditing(undefined);
              setPanel(panel === "picker" ? undefined : "picker");
            }}
          >
            + Add
          </button>
          <button
            type="button"
            className="query-tool query-help"
            aria-label="Query syntax"
            aria-expanded={panel === "legend"}
            onClick={() => {
              setPanel(panel === "legend" ? undefined : "legend");
            }}
          >
            ?
          </button>
          {actions}
        </span>
      </div>
      {suggestions.length > 0 && token !== "" && (
        <ul id={listId} className="query-suggestions" role="listbox" aria-label="Suggestions">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.text}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                accept(suggestion);
              }}
            >
              <code>{suggestion.label}</code>
              {suggestion.hint && <span>{suggestion.hint}</span>}
              {index === active && <kbd>Tab</kbd>}
            </li>
          ))}
        </ul>
      )}
      <div className="query-status" aria-live="polite">
        {result.ok ? status : <span className="query-error">{result.error}</span>}
      </div>
      {panel === "legend" && (
        <Legend
          onPick={(text) => {
            setDraft(text);
            setPanel(undefined);
            input.current?.focus();
          }}
        />
      )}
      {panel === "picker" && (
        <Picker
          key={editing ? `${String(editing.start)}-${editing.text}` : "new"}
          vocabulary={vocabulary}
          start={startFor(editing)}
          onClose={() => {
            setPanel(undefined);
            setEditing(undefined);
          }}
          onDone={(text) => {
            if (editing) {
              const next = joinQuery(
                committed.slice(0, editing.start),
                text,
                committed.slice(editing.end),
              );
              setCommitted(next);
              setFresh(text);
              publish(next, draft);
            } else {
              commit(text, draft);
            }
            setPanel(undefined);
            setEditing(undefined);
            input.current?.focus();
          }}
        />
      )}
    </div>
  );
}
