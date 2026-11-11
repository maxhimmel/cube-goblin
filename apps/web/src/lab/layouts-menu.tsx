import { mode } from "#mode";
import { newLayoutId } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useState } from "react";
import { recallStates, replaceStates } from "../view-choices.ts";

export function isLabSetting(key: string): boolean {
  return key.startsWith("lab.") || key.startsWith("labc.");
}

export function LayoutsMenu({ onApply }: { onApply: () => void }): ReactNode {
  const layouts = mode.useLayouts();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const put = mode.putLayout;
  if (!layouts || !put) {
    return null;
  }
  const save = (): void => {
    const name = label.trim();
    if (name === "") {
      return;
    }
    const same = layouts.find((layout) => layout.label === name);
    put({
      id: same?.id ?? newLayoutId(layouts),
      label: name,
      settings: recallStates(isLabSetting),
    });
    setLabel("");
  };
  return (
    <div className="lab-menu">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        Layouts{layouts.length > 0 && ` · ${String(layouts.length)}`}
      </button>
      {open && (
        <div className="lab-menu-list" role="group" aria-label="Layouts">
          {layouts.length === 0 && <span className="muted">No layouts saved yet</span>}
          {layouts.map((layout) => (
            <div key={layout.id} className="lab-layout">
              <button
                type="button"
                className="lab-layout-apply"
                onClick={() => {
                  replaceStates(isLabSetting, layout.settings);
                  setOpen(false);
                  onApply();
                }}
              >
                {layout.label}
              </button>
              {mode.deleteLayout && (
                <button
                  type="button"
                  className="lab-filter-remove"
                  aria-label={`Delete layout ${layout.label}`}
                  onClick={() => {
                    mode.deleteLayout?.(layout.id);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <form
            className="lab-layout-save"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <input
              aria-label="Layout name"
              placeholder="Save current as…"
              value={label}
              onChange={(event) => {
                setLabel(event.target.value);
              }}
            />
            <button type="submit" disabled={label.trim() === ""}>
              Save
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
