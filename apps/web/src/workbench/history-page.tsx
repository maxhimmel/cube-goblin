import type { LogEntry, Workbench } from "@repo/cube/browser";
import { CURRENT, entryPoint, parseMessage, parsePoint } from "@repo/cube/browser";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";
import { LogView } from "../log/log-view.tsx";
import type { Marker } from "../log/points.ts";
import { queryClient } from "../query-client.ts";
import {
  BOARD_QUERY_KEY,
  CUBE_QUERY_KEY,
  FILTERS_QUERY_KEY,
  LOG_QUERY_KEY,
  VERSIONS_QUERY_KEY,
  fetchLog,
  fetchVersions,
  revertRequest,
  saveVersionRequest,
} from "./api.ts";
import { Comparison } from "./compare.tsx";
import { showToast } from "./toast.tsx";

async function refresh(): Promise<void> {
  await Promise.all(
    [CUBE_QUERY_KEY, BOARD_QUERY_KEY, FILTERS_QUERY_KEY, LOG_QUERY_KEY, VERSIONS_QUERY_KEY].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

function useRevert(onDone: () => void) {
  const revert = useMutation({
    mutationFn: (ids: readonly string[]) => revertRequest(ids),
    onSuccess: async (entry: LogEntry) => {
      onDone();
      await refresh();
      showToast({
        message: parseMessage(entry.message).subject,
        tone: "info",
        action: {
          label: "Undo",
          run: () => {
            revert.mutate([entry.id]);
          },
        },
      });
    },
    onError: (error: Error) => {
      showToast({ message: error.message, tone: "error" });
    },
  });
  return revert;
}

function SaveVersion(): ReactNode {
  const [label, setLabel] = useState("");
  const save = useMutation({
    mutationFn: saveVersionRequest,
    onSuccess: async (version) => {
      setLabel("");
      showToast({ message: `Saved version "${version.label}"`, tone: "info" });
      await queryClient.invalidateQueries({ queryKey: VERSIONS_QUERY_KEY });
    },
    onError: (error) => {
      showToast({ message: error.message, tone: "error" });
    },
  });
  return (
    <form
      className="inline history-save"
      onSubmit={(event) => {
        event.preventDefault();
        if (label.trim()) {
          save.mutate(label.trim());
        }
      }}
    >
      <input
        aria-label="Version name"
        value={label}
        onChange={(event) => {
          setLabel(event.target.value);
        }}
        placeholder="name a version, e.g. before the trim"
        size={28}
      />
      <button type="submit" disabled={save.isPending || !label.trim()}>
        Save version
      </button>
    </form>
  );
}

function pointLabel(id: string, entries: readonly LogEntry[], versions: readonly Marker[]): string {
  const point = parsePoint(id);
  if (point.kind === "current") {
    return "Now";
  }
  if (point.kind === "version") {
    return `Version "${versions.find((version) => version.id === point.id)?.label ?? id}"`;
  }
  const entry = entries.find((item) => item.id === point.entry);
  const subject = entry ? parseMessage(entry.message).subject : point.entry;
  return `${point.side === "before" ? "Before" : "After"} "${subject}"`;
}

function PointButtons({
  name,
  from,
  to,
  alone,
  current,
  onPick,
}: {
  name: string;
  from: string;
  to: string;
  alone: string;
  current: { from: string | undefined; to: string | undefined };
  onPick: (next: { from: string; to: string }) => void;
}): ReactNode {
  return (
    <>
      <button
        type="button"
        className="log-point"
        aria-label={`Compare from ${name}`}
        title="Compare from here"
        aria-pressed={current.from === from}
        onClick={() => {
          onPick({ from, to: current.to ?? CURRENT });
        }}
      >
        From
      </button>
      <button
        type="button"
        className="log-point"
        aria-label={`Compare to ${name}`}
        title="Compare up to here"
        aria-pressed={current.to === to}
        onClick={() => {
          onPick({ from: current.from ?? alone, to });
        }}
      >
        To
      </button>
    </>
  );
}

function ComparePanel({
  from,
  to,
  labelOf,
  cube,
  onClose,
}: {
  from: string;
  to: string;
  labelOf: (id: string) => string;
  cube: Workbench | undefined;
  onClose: () => void;
}): ReactNode {
  return (
    <aside className="pane history-compare" aria-labelledby="compare-title">
      <header className="pane-bar history-compare-head">
        <h2 id="compare-title">
          {labelOf(from)} → {labelOf(to)}
        </h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </header>
      {cube ? (
        <Comparison from={from} to={to} labelOf={labelOf} cube={cube} />
      ) : (
        <p className="muted">Loading cube…</p>
      )}
    </aside>
  );
}

export function WorkbenchHistoryPage({ cube }: { cube: Workbench | undefined }): ReactNode {
  const search = useSearch({ from: "/history" });
  const navigate = useNavigate();
  const log = useQuery({ queryKey: LOG_QUERY_KEY, queryFn: fetchLog });
  const versions = useQuery({ queryKey: VERSIONS_QUERY_KEY, queryFn: fetchVersions });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const revert = useRevert(() => {
    setSelected(new Set());
  });
  const error = log.error ?? versions.error;
  if (error) {
    return <p className="error">{error.message}</p>;
  }
  if (!log.data || !versions.data) {
    return <p className="muted">Loading history…</p>;
  }
  const entries = log.data;
  const markers: Marker[] = versions.data.map((version) => ({
    id: version.id,
    label: version.label,
    at: version.savedAt,
  }));
  const known = new Set(entries.map((entry) => entry.id));
  const picked = [...selected].filter((id) => known.has(id));
  const from = search.from;
  const to = from === undefined ? undefined : (search.to ?? CURRENT);
  const pick = (next: { from: string | undefined; to: string | undefined }): void => {
    void navigate({ to: "/history", search: (prev) => ({ ...prev, ...next }), resetScroll: false });
  };
  const labelOf = (id: string): string => pointLabel(id, entries, markers);
  const current = { from, to };
  return (
    <LogView
      entries={entries}
      versions={markers}
      from={from}
      to={to}
      selected={selected}
      onSelect={(id, on) => {
        setSelected((now) => {
          const next = new Set(now);
          if (on) {
            next.add(id);
          } else {
            next.delete(id);
          }
          return next;
        });
      }}
      compare={
        from !== undefined &&
        to !== undefined && (
          <ComparePanel
            from={from}
            to={to}
            labelOf={labelOf}
            cube={cube}
            onClose={() => {
              pick({ from: undefined, to: undefined });
            }}
          />
        )
      }
      actions={
        <>
          <button
            type="button"
            disabled={picked.length === 0 || revert.isPending}
            onClick={() => {
              revert.mutate(picked);
            }}
          >
            Revert {picked.length > 0 ? `${String(picked.length)} selected` : "selected"}
          </button>
          {picked.length > 0 && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setSelected(new Set());
              }}
            >
              Clear
            </button>
          )}
          <SaveVersion />
        </>
      }
      entryActions={(entry) => {
        const subject = parseMessage(entry.message).subject;
        return (
          <>
            <PointButtons
              name={subject}
              from={entryPoint("before", entry.id)}
              to={entryPoint("after", entry.id)}
              alone={entryPoint("before", entry.id)}
              current={current}
              onPick={pick}
            />
            <button
              type="button"
              className="log-revert"
              aria-label={`Revert ${subject}`}
              disabled={revert.isPending}
              onClick={() => {
                revert.mutate([entry.id]);
              }}
            >
              Revert
            </button>
          </>
        );
      }}
      versionActions={(version) => (
        <PointButtons
          name={`version ${version.label}`}
          from={version.id}
          to={version.id}
          alone={CURRENT}
          current={current}
          onPick={pick}
        />
      )}
    />
  );
}
