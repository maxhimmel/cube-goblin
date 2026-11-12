import type { LogEntry } from "@repo/cube/browser";
import { parseMessage, slugify } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { CardLink } from "../card-pane.tsx";

export interface LogViewProps {
  entries: readonly LogEntry[];
  selected?: ReadonlySet<string>;
  onSelect?: (id: string, on: boolean) => void;
  actions?: ReactNode;
}

function day(at: string): string {
  return new Date(at).toLocaleDateString(undefined, { dateStyle: "full" });
}

function time(at: string): string {
  return new Date(at).toLocaleTimeString(undefined, { timeStyle: "short" });
}

function cardNames(entry: LogEntry): string[] {
  return entry.changes.cards.map((change) => change.after?.name ?? change.before?.name ?? "");
}

function TrailerValue({
  trailerKey,
  value,
  name,
}: {
  trailerKey: string;
  value: string;
  name: string | undefined;
}): ReactNode {
  if (trailerKey === "Card" && name !== undefined && value.startsWith(name)) {
    return (
      <>
        <CardLink slug={slugify(name)}>{name}</CardLink>
        {value.slice(name.length)}
      </>
    );
  }
  return value;
}

function Entry({
  entry,
  selected,
  onSelect,
}: {
  entry: LogEntry;
  selected: boolean;
  onSelect: ((id: string, on: boolean) => void) | undefined;
}): ReactNode {
  const message = parseMessage(entry.message);
  const names = cardNames(entry);
  return (
    <li className="log-entry" data-testid="log-entry" data-source={entry.source}>
      <div className="log-entry-head">
        {onSelect && (
          <input
            type="checkbox"
            aria-label={`Select ${message.subject}`}
            checked={selected}
            onChange={(event) => {
              onSelect(entry.id, event.target.checked);
            }}
          />
        )}
        <time dateTime={entry.at} className="muted">
          {time(entry.at)}
        </time>
        <strong className="log-subject">{message.subject}</strong>
        {entry.source !== "workbench" && <span className="log-source">{entry.source}</span>}
      </div>
      {message.body !== "" && <p className="log-body">{message.body}</p>}
      {message.trailers.length > 0 && (
        <dl className="log-trailers">
          {message.trailers.map(([key, value], index) => {
            const ordinal = message.trailers.slice(0, index).filter(([k]) => k === "Card").length;
            const name = key === "Card" ? names[ordinal] : undefined;
            return (
              <div key={`${key}-${String(index)}`} data-trailer={key}>
                <dt>{key}</dt>
                <dd>
                  <TrailerValue trailerKey={key} value={value} name={name} />
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </li>
  );
}

export function LogView({ entries, selected, onSelect, actions }: LogViewProps): ReactNode {
  const [query, setQuery] = useState("");
  const days = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const shown = [...entries]
      .reverse()
      .filter((entry) => needle === "" || entry.message.toLowerCase().includes(needle));
    const groups = new Map<string, LogEntry[]>();
    for (const entry of shown) {
      const key = day(entry.at);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.entries()];
  }, [entries, query]);

  return (
    <section className="log-page">
      <header className="log-toolbar">
        <h1>Change log</h1>
        <input
          type="search"
          aria-label="Filter the log"
          placeholder="filter by card, tag, or words"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          size={32}
        />
        {actions}
      </header>
      {entries.length === 0 ? (
        <p className="muted">No edits logged yet. Every saved edit lands here.</p>
      ) : days.length === 0 ? (
        <p className="muted">No entries match.</p>
      ) : (
        days.map(([label, items]) => (
          <section key={label} className="log-day">
            <h2>{label}</h2>
            <ol className="log-entries">
              {items.map((entry) => (
                <Entry
                  key={entry.id}
                  entry={entry}
                  selected={selected?.has(entry.id) ?? false}
                  onSelect={onSelect}
                />
              ))}
            </ol>
          </section>
        ))
      )}
    </section>
  );
}
