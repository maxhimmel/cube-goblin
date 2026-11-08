import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
}

const DISMISS_MS = 8000;

let current: Toast | undefined;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function dismissToast(): void {
  clearTimeout(timer);
  current = undefined;
  emit();
}

export function showToast(toast: Omit<Toast, "id">): void {
  clearTimeout(timer);
  current = { ...toast, id: nextId++ };
  timer = setTimeout(dismissToast, DISMISS_MS);
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function Toaster(): ReactNode {
  const toast = useSyncExternalStore(subscribe, () => current);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toast && (
        <div className="toast" data-tone={toast.tone} key={toast.id}>
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.run();
                dismissToast();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={dismissToast}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
