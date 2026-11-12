import type { LogEntry } from "@repo/cube/browser";
import { parseMessage } from "@repo/cube/browser";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { LogView } from "../log/log-view.tsx";
import { queryClient } from "../query-client.ts";
import {
  BOARD_QUERY_KEY,
  CUBE_QUERY_KEY,
  FILTERS_QUERY_KEY,
  LOG_QUERY_KEY,
  fetchLog,
  revertRequest,
} from "./api.ts";
import { showToast } from "./toast.tsx";

async function refresh(): Promise<void> {
  await Promise.all(
    [CUBE_QUERY_KEY, BOARD_QUERY_KEY, FILTERS_QUERY_KEY, LOG_QUERY_KEY].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
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

export function WorkbenchLogPage(): ReactNode {
  const log = useQuery({ queryKey: LOG_QUERY_KEY, queryFn: fetchLog });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const revert = useRevert(() => {
    setSelected(new Set());
  });
  if (log.error) {
    return <p className="error">{log.error.message}</p>;
  }
  if (!log.data) {
    return <p className="muted">Loading the change log…</p>;
  }
  const known = new Set(log.data.map((entry) => entry.id));
  const picked = [...selected].filter((id) => known.has(id));
  return (
    <LogView
      entries={log.data}
      selected={selected}
      onSelect={(id, on) => {
        setSelected((current) => {
          const next = new Set(current);
          if (on) {
            next.add(id);
          } else {
            next.delete(id);
          }
          return next;
        });
      }}
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
        </>
      }
      entryActions={(entry) => (
        <button
          type="button"
          className="log-revert"
          aria-label={`Revert ${parseMessage(entry.message).subject}`}
          disabled={revert.isPending}
          onClick={() => {
            revert.mutate([entry.id]);
          }}
        >
          Revert
        </button>
      )}
    />
  );
}
