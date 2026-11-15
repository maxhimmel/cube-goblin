import type { CubeList, CubeRef, CubesBridge } from "@repo/server/events";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDownIcon } from "../icons.tsx";
import { Menu } from "../menu.tsx";
import { queryClient } from "../query-client.ts";
import { showToast } from "./toast.tsx";

const CUBES_QUERY_KEY = ["desktop", "cubes"] as const;
const SETTLE_POLL_MS = 50;

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
