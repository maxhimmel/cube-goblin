import type { LogEntry } from "@repo/cube/browser";
import { parseMessage, slugify } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { CardLink } from "../card-pane.tsx";
import { Timeline } from "./timeline.tsx";

export interface LogViewProps {
  entries: readonly LogEntry[];
  selected?: ReadonlySet<string>;
  onSelect?: (id: string, on: boolean) => void;
  actions?: ReactNode;
  entryActions?: (entry: LogEntry) => ReactNode;
}

function day(at: string): string {
  return new Date(at).toLocaleDateString(undefined, { dateStyle: "full" });
}

function time(at: string): string {
  return new Date(at).toLocaleTimeString(undefined, { timeStyle: "short" });
}

export function entryElementId(id: string): string {
  return `log-entry-${id}`;
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
  actions,
  active,
  onActive,
  onInactive,
}: {
  entry: LogEntry;
  selected: boolean;
  onSelect: ((id: string, on: boolean) => void) | undefined;
  actions: ReactNode;
  active: boolean;
  onActive: (id: string) => void;
  onInactive: (id: string) => void;
}): ReactNode {
  const message = parseMessage(entry.message);
  const names = cardNames(entry);
  return (
    <li
      id={entryElementId(entry.id)}
      className="log-entry"
      data-testid="log-entry"
      data-source={entry.source}
      data-active={active}
      onMouseEnter={() => {
        onActive(entry.id);
      }}
      onFocus={() => {
        onActive(entry.id);
      }}
      onMouseLeave={() => {
        onInactive(entry.id);
      }}
      onBlur={() => {
        onInactive(entry.id);
      }}
    >
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
        {actions !== undefined && <span className="log-entry-actions">{actions}</span>}
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

export function LogView({
  entries,
  selected,
  onSelect,
  actions,
  entryActions,
}: LogViewProps): ReactNode {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string | undefined>(undefined);
  const [jump, setJump] = useState<{ id: string } | undefined>(undefined);
  useEffect(() => {
    if (jump === undefined) {
      return;
    }
    document
      .getElementById(entryElementId(jump.id))
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [jump]);
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
      {entries.length > 0 && (
        <Timeline
          entries={entries}
          active={active}
          onPick={(id) => {
            const entry = entries.find((item) => item.id === id);
            if (entry && !entry.message.toLowerCase().includes(query.trim().toLowerCase())) {
              setQuery("");
            }
            setActive(id);
            setJump({ id });
          }}
        />
      )}
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
                  actions={entryActions?.(entry)}
                  active={active === entry.id}
                  onActive={setActive}
                  onInactive={(id) => {
                    setActive((current) => (current === id ? undefined : current));
                  }}
                />
              ))}
            </ol>
          </section>
        ))
      )}
    </section>
  );
}
