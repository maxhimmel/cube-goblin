import type { LogEntry } from "@repo/cube/browser";
import { parseMessage, slugify } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { CardLink } from "../card-pane.tsx";
import type { LogRow } from "./fold.ts";
import { foldCanceled, foldSummary, foldedIds, rowMatches } from "./fold.ts";
import type { Marker } from "./points.ts";
import { markerPosition, rangeOf } from "./points.ts";
import { Timeline } from "./timeline.tsx";
import { useRemembered } from "../view-choices.ts";

export interface LogViewProps {
  entries: readonly LogEntry[];
  versions?: readonly Marker[];
  selected?: ReadonlySet<string>;
  onSelect?: (id: string, on: boolean) => void;
  actions?: ReactNode;
  entryActions?: (entry: LogEntry) => ReactNode;
  versionActions?: (version: Marker) => ReactNode;
  compare?: ReactNode;
  from?: string | undefined;
  to?: string | undefined;
}

type HistoryRow = LogRow | { kind: "version"; version: Marker };

const NO_VERSIONS: readonly Marker[] = [];

function rowTime(row: HistoryRow): string {
  if (row.kind === "version") {
    return row.version.at;
  }
  return row.kind === "fold" ? (row.entries[row.entries.length - 1]?.at ?? "") : row.entry.at;
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
  open,
  inRange,
  onToggle,
  onActive,
  onInactive,
}: {
  entry: LogEntry;
  selected: boolean;
  onSelect: ((id: string, on: boolean) => void) | undefined;
  actions: ReactNode;
  active: boolean;
  open: boolean;
  inRange: boolean;
  onToggle: (id: string) => void;
  onActive: (id: string) => void;
  onInactive: (id: string) => void;
}): ReactNode {
  const message = parseMessage(entry.message);
  const names = cardNames(entry);
  const details = message.body !== "" || message.trailers.length > 0;
  return (
    <li
      id={entryElementId(entry.id)}
      className="log-entry"
      data-testid="log-entry"
      data-source={entry.source}
      data-active={active}
      data-open={open}
      data-in-range={inRange || undefined}
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
        {details ? (
          <button
            type="button"
            className="log-subject"
            aria-expanded={open}
            onClick={() => {
              onToggle(entry.id);
            }}
          >
            {message.subject}
          </button>
        ) : (
          <strong className="log-subject">{message.subject}</strong>
        )}
        {entry.source !== "workbench" && <span className="log-source">{entry.source}</span>}
        {actions !== undefined && <span className="log-entry-actions">{actions}</span>}
      </div>
      {open && message.body !== "" && <p className="log-body">{message.body}</p>}
      {open && message.trailers.length > 0 && (
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

function VersionRow({
  version,
  actions,
  point,
}: {
  version: Marker;
  actions: ReactNode;
  point: "from" | "to" | undefined;
}): ReactNode {
  return (
    <li
      className="log-version"
      data-testid="log-version"
      data-version={version.id}
      data-point={point}
    >
      <time dateTime={version.at} className="muted">
        {time(version.at)}
      </time>
      <span className="log-version-mark" aria-hidden="true">
        ◆
      </span>
      <span>
        Version <strong>{version.label}</strong> saved
      </span>
      {actions !== undefined && <span className="log-entry-actions">{actions}</span>}
    </li>
  );
}

export function LogView({
  entries,
  versions = NO_VERSIONS,
  selected,
  onSelect,
  actions,
  entryActions,
  versionActions,
  compare,
  from,
  to,
}: LogViewProps): ReactNode {
  const [query, setQuery] = useRemembered("log.query", "", z.string());
  const [active, setActive] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [jump, setJump] = useState<{ id: string } | undefined>(undefined);
  useEffect(() => {
    if (jump === undefined) {
      return;
    }
    document
      .getElementById(entryElementId(jump.id))
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [jump]);
  const rows = useMemo(() => foldCanceled(entries), [entries]);
  const plotted = useMemo(() => {
    const folded = foldedIds(rows);
    return entries.filter((entry) => !folded.has(entry.id));
  }, [entries, rows]);
  const markers = useMemo(
    () =>
      versions.map((version) => ({
        id: version.id,
        label: version.label,
        x: markerPosition(plotted, version.at),
      })),
    [plotted, versions],
  );
  const range = useMemo(() => rangeOf(entries, versions, from, to), [entries, versions, from, to]);
  const days = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const items: HistoryRow[] = [
      ...rows.filter((item) => rowMatches(item, needle)),
      ...versions
        .filter((version) => needle === "" || version.label.toLowerCase().includes(needle))
        .map((version) => ({ kind: "version" as const, version })),
    ].sort((a, b) => rowTime(b).localeCompare(rowTime(a)));
    const groups = new Map<string, HistoryRow[]>();
    for (const row of items) {
      const key = day(rowTime(row));
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return [...groups.entries()];
  }, [rows, versions, query]);
  const toggle = (id: string): void => {
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  };
  const renderEntry = (entry: LogEntry): ReactNode => (
    <Entry
      key={entry.id}
      entry={entry}
      selected={selected?.has(entry.id) ?? false}
      onSelect={onSelect}
      actions={entryActions?.(entry)}
      active={active === entry.id}
      open={open.has(entry.id)}
      inRange={range.has(entry.id)}
      onToggle={toggle}
      onActive={setActive}
      onInactive={(id) => {
        setActive((current) => (current === id ? undefined : current));
      }}
    />
  );
  const allOpen = entries.length > 0 && entries.every((entry) => open.has(entry.id));

  return (
    <section className="log-page">
      <header className="log-toolbar">
        <h1 className="sr-only">History</h1>
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
        <button
          type="button"
          onClick={() => {
            setOpen(allOpen ? new Set() : new Set(entries.map((entry) => entry.id)));
          }}
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
        {actions}
      </header>
      {entries.length > 0 && (
        <Timeline
          entries={plotted}
          markers={markers}
          active={active}
          onPick={(id) => {
            const entry = entries.find((item) => item.id === id);
            if (entry && !entry.message.toLowerCase().includes(query.trim().toLowerCase())) {
              setQuery("");
            }
            setActive(id);
            setOpen((current) => new Set([...current, id]));
            setJump({ id });
          }}
        />
      )}
      <div className="log-list">
        {compare}
        {entries.length === 0 && versions.length === 0 ? (
          <p className="muted">No edits logged yet. Every saved edit lands here.</p>
        ) : days.length === 0 ? (
          <p className="muted">No entries match.</p>
        ) : (
          days.map(([label, items]) => (
            <section key={label} className="log-day">
              <h2>{label}</h2>
              <ol className="log-entries">
                {items.map((row) =>
                  row.kind === "entry" ? (
                    renderEntry(row.entry)
                  ) : row.kind === "version" ? (
                    <VersionRow
                      key={`version-${row.version.id}`}
                      version={row.version}
                      actions={versionActions?.(row.version)}
                      point={
                        from === row.version.id ? "from" : to === row.version.id ? "to" : undefined
                      }
                    />
                  ) : (
                    <li key={row.id} className="log-fold" data-testid="log-fold">
                      <details>
                        <summary>
                          <time dateTime={row.entries[0]?.at} className="muted">
                            {time(row.entries[0]?.at ?? "")}
                          </time>
                          <span>{foldSummary(row)}</span>
                        </summary>
                        <ol className="log-entries">
                          {[...row.entries].reverse().map(renderEntry)}
                        </ol>
                      </details>
                    </li>
                  ),
                )}
              </ol>
            </section>
          ))
        )}
      </div>
    </section>
  );
}
