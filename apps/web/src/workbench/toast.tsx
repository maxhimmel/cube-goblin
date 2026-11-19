import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
  sticky?: boolean;
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

function pauseDismiss(): void {
  clearTimeout(timer);
}

function resumeDismiss(): void {
  clearTimeout(timer);
  if (current?.sticky !== true) {
    timer = setTimeout(dismissToast, DISMISS_MS);
  }
}

export function showToast(toast: Omit<Toast, "id">): void {
  current = { ...toast, id: nextId++ };
  resumeDismiss();
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function ToastView({ toast }: { toast: Toast }): ReactNode {
  return (
    <div
      className="toast"
      data-tone={toast.tone}
      onMouseEnter={pauseDismiss}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) {
          resumeDismiss();
        }
      }}
      onFocus={pauseDismiss}
      onBlur={resumeDismiss}
    >
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
  );
}

export function Toaster(): ReactNode {
  const toast = useSyncExternalStore(subscribe, () => current);
  return (
    <div className="toaster">
      <div role="status">
        {toast?.tone === "info" && <ToastView key={toast.id} toast={toast} />}
      </div>
      <div role="alert">
        {toast?.tone === "error" && <ToastView key={toast.id} toast={toast} />}
      </div>
    </div>
  );
}
