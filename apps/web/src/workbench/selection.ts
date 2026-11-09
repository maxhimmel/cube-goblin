import { useSyncExternalStore } from "react";

let selected: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: ReadonlySet<string>): void {
  selected = next;
  for (const listener of listeners) {
    listener();
  }
}

export function useSelection(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => selected);
}

export function setSelected(slugs: readonly string[], on: boolean): void {
  const next = new Set(selected);
  for (const slug of slugs) {
    if (on) {
      next.add(slug);
    } else {
      next.delete(slug);
    }
  }
  commit(next);
}

export function clearSelection(): void {
  commit(new Set());
}
