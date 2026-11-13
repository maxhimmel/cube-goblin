import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ForgeSettings } from "../forge/view-settings.tsx";
import { SettingsIcon } from "../icons.tsx";

function SettingsDialog({ onClose }: { onClose: () => void }): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog ref={dialog} className="sheet settings-panel" aria-label="Settings" onClose={onClose}>
      <header className="sheet-head">
        <h2>Settings</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            dialog.current?.close();
          }}
        >
          ×
        </button>
      </header>
      <div className="settings-page">
        <ForgeSettings />
      </div>
    </dialog>
  );
}

export function ShareSettings(): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label="Settings"
        title="Settings"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
        }}
      >
        <SettingsIcon />
      </button>
      {open && (
        <SettingsDialog
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
