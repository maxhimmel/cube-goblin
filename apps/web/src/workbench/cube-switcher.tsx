import type { OfflineStatus } from "@repo/cube/browser";
import type { CubeList, CubeRef, CubesBridge } from "@repo/server/events";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDownIcon } from "../icons.tsx";
import { Menu } from "../menu.tsx";
import { queryClient } from "../query-client.ts";
import { showToast } from "./toast.tsx";
import {
  OFFLINE_QUERY_KEY,
  OFFLINE_REASON,
  fetchOffline,
  makeOffline,
  useOnline,
} from "./connection.ts";

const CUBES_QUERY_KEY = ["desktop", "cubes"] as const;
const SETTLE_POLL_MS = 50;
const RUN_POLL_MS = 500;
const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;

function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit] ?? "B"}`;
}

function offlineText(status: OfflineStatus): string {
  const size = formatBytes(status.bytes);
  const { run } = status;
  if (run?.running === true) {
    return `Saving for offline… ${String(run.done)} of ${String(run.total)}`;
  }
  if (status.complete) {
    return `Available offline · ${size}`;
  }
  return `${String(status.cached)} of ${String(status.cards)} cards saved offline · ${size}`;
}

function OfflineLine({ status }: { status: OfflineStatus | undefined }): ReactNode {
  return (
    <span className="cube-offline muted" data-complete={status?.complete}>
      {status ? offlineText(status) : "Checking offline copy…"}
    </span>
  );
}

function CurrentOffline(): ReactNode {
  const online = useOnline();
  const { data: status } = useQuery({
    queryKey: OFFLINE_QUERY_KEY,
    queryFn: fetchOffline,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.run?.running === true ? RUN_POLL_MS : false),
  });
  const start = useMutation({
    mutationFn: makeOffline,
    onSuccess: (next) => {
      queryClient.setQueryData(OFFLINE_QUERY_KEY, next);
    },
    onError: (error: Error) => {
      showToast({ message: error.message, tone: "error" });
    },
  });
  const run = status?.run;
  const running = run?.running === true;
  return (
    <>
      <OfflineLine status={status} />
      {run !== undefined && !running && run.failed > 0 && (
        <span className="cube-offline error" role="alert">
          {String(run.failed)} card(s) not saved{run.error === undefined ? "" : `: ${run.error}`}
        </span>
      )}
      {run?.running === false && run.failed === 0 && run.error !== undefined && (
        <span className="cube-offline error" role="alert">
          {run.error}
        </span>
      )}
      {status !== undefined && (!status.complete || running) && (
        <button
          type="button"
          className="cube-make-offline"
          disabled={running || start.isPending || !online}
          title={online ? "Save every card's data and images on this computer" : OFFLINE_REASON}
          onClick={() => {
            start.mutate();
          }}
        >
          {running ? "Saving…" : "Make available offline"}
        </button>
      )}
    </>
  );
}

function OtherOffline({ cube, cubes }: { cube: CubeRef; cubes: CubesBridge }): ReactNode {
  const { data: status } = useQuery({
    queryKey: [...CUBES_QUERY_KEY, "offline", cube.dir],
    queryFn: () => cubes.offlineStatus(cube.dir),
    staleTime: 0,
    retry: false,
  });
  return <OfflineLine status={status} />;
}

function cubesBridge(): CubesBridge | undefined {
  return window.desktop?.cubes;
}

async function settled(): Promise<void> {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  while (queryClient.isMutating() > 0) {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_POLL_MS));
  }
}

async function leaveFor(open: () => Promise<CubeRef | undefined>): Promise<void> {
  try {
    await settled();
    const opened = await open();
    if (opened !== undefined) {
      window.location.reload();
    }
  } catch (error) {
    showToast({ message: error instanceof Error ? error.message : String(error), tone: "error" });
  }
}

function NewCubeForm({ cubes }: { cubes: CubesBridge }): ReactNode {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  return (
    <form
      className="cube-new"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed !== "") {
          void leaveFor(() => cubes.create(trimmed));
        }
      }}
    >
      <input
        aria-label="New cube name"
        placeholder="New cube name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <button type="submit" disabled={trimmed === ""}>
        New cube
      </button>
    </form>
  );
}

function RecentCube({
  cube,
  cubes,
  list,
}: {
  cube: CubeRef;
  cubes: CubesBridge;
  list: CubeList;
}): ReactNode {
  const current = cube.dir === list.current.dir;
  return (
    <li className="cube-recent" data-current={current}>
      <button
        type="button"
        className="cube-open"
        aria-current={current ? "true" : undefined}
        disabled={current}
        title={cube.dir}
        onClick={() => {
          void leaveFor(() => cubes.switchTo(cube.dir));
        }}
      >
        {cube.name}
      </button>
      {!current && (
        <button
          type="button"
          className="cube-remove"
          aria-label={`Remove ${cube.name} from the list`}
          title="Remove from list (the files stay)"
          onClick={() => {
            void cubes.remove(cube.dir).then(
              (next) => {
                queryClient.setQueryData(CUBES_QUERY_KEY, next);
              },
              (error: unknown) => {
                showToast({ message: String(error), tone: "error" });
              },
            );
          }}
        >
          Remove
        </button>
      )}
      {current ? <CurrentOffline /> : <OtherOffline cube={cube} cubes={cubes} />}
    </li>
  );
}

function CubeMenu({ cubes }: { cubes: CubesBridge }): ReactNode {
  const { data: list } = useQuery({ queryKey: CUBES_QUERY_KEY, queryFn: () => cubes.list() });
  return (
    <div className="cube-menu">
      {list && (
        <ul className="cube-recents" aria-label="Recent cubes">
          {list.recent.map((cube) => (
            <RecentCube key={cube.dir} cube={cube} cubes={cubes} list={list} />
          ))}
        </ul>
      )}
      <NewCubeForm cubes={cubes} />
      <button
        type="button"
        onClick={() => {
          void leaveFor(() => cubes.openFolder());
        }}
      >
        Open folder…
      </button>
    </div>
  );
}

export function CubeSwitcher(): ReactNode {
  const cubes = cubesBridge();
  if (cubes === undefined) {
    return null;
  }
  return (
    <Menu
      label={
        <>
          <ChevronDownIcon />
          <span className="sr-only">Switch cube</span>
        </>
      }
      listLabel="Cubes"
    >
      <CubeMenu cubes={cubes} />
    </Menu>
  );
}
