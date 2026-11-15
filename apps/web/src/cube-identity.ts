import { slugify } from "@repo/cube/browser";
import { useSyncExternalStore } from "react";

let identity = { id: "", name: "" };
const listeners = new Set<() => void>();

export function setCubeIdentity(next: { id: string; name: string }): void {
  identity = { id: next.id, name: next.name };
  document.title = next.name;
  for (const listener of listeners) {
    listener();
  }
}

export function cubeId(): string {
  return identity.id;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCubeName(): string {
  return useSyncExternalStore(subscribe, () => identity.name);
}

export function cubeFileName(suffix: string): string {
  return `${slugify(identity.name) || "cube"}-${suffix}.html`;
}
