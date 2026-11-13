import type { CubeConfig } from "@repo/cube/browser";
import { cubeConfigSchema } from "@repo/cube/browser";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { ForgeSettings } from "../forge/view-settings.tsx";
import { z } from "zod";
import { queryClient } from "../query-client.ts";
import { useRemembered } from "../view-choices.ts";
import { CONFIG_QUERY_KEY, CUBE_QUERY_KEY, fetchConfig, saveConfigRequest } from "./api.ts";
import { showToast } from "./toast.tsx";

const FORMATS = cubeConfigSchema.shape.format.options;

const TABS = [
  { id: "cube", label: "Cube" },
  { id: "forge", label: "Forge" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function SettingsPanel({ onClose }: { onClose: () => void }): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const config = useQuery({ queryKey: CONFIG_QUERY_KEY, queryFn: fetchConfig });
  const [tab, setTab] = useRemembered<Tab>(
    "settings.tab",
    "cube",
    z.enum(TABS.map((option) => option.id) as [Tab, ...Tab[]]),
  );

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
      <div className="settings-body">
        <div
          className="settings-tabs"
          role="tablist"
          aria-label="Settings"
          aria-orientation="vertical"
        >
          {TABS.map((option, index) => (
            <button
              key={option.id}
              id={`settings-tab-${option.id}`}
              type="button"
              role="tab"
              aria-selected={option.id === tab}
              aria-controls={`settings-page-${option.id}`}
              tabIndex={option.id === tab ? 0 : -1}
              onClick={() => {
                setTab(option.id);
              }}
              onKeyDown={(event) => {
                const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
                if (step === undefined) {
                  return;
                }
                event.preventDefault();
                const next = TABS[(index + step + TABS.length) % TABS.length];
                if (next) {
                  setTab(next.id);
                  document.getElementById(`settings-tab-${next.id}`)?.focus();
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div
          className="settings-page"
          role="tabpanel"
          id="settings-page-cube"
          aria-labelledby="settings-tab-cube"
          hidden={tab !== "cube"}
        >
          {config.error && (
            <p role="alert" className="error">
              {config.error.message}
            </p>
          )}
          {config.data && <CubeSettings key={JSON.stringify(config.data)} saved={config.data} />}
        </div>
        <div
          className="settings-page"
          role="tabpanel"
          id="settings-page-forge"
          aria-labelledby="settings-tab-forge"
          hidden={tab !== "forge"}
        >
          <ForgeSettings />
        </div>
      </div>
    </dialog>
  );
}

function CubeSettings({ saved }: { saved: CubeConfig }): ReactNode {
  const [format, setFormat] = useState(saved.format);
  const [min, setMin] = useState(String(saved.size.min));
  const [max, setMax] = useState(String(saved.size.max));
  const draft = cubeConfigSchema.safeParse({
    format,
    size: { min: Number(min), max: Number(max) },
  });
  const changed = !draft.success || JSON.stringify(draft.data) !== JSON.stringify(saved);
  const save = useMutation({
    mutationFn: saveConfigRequest,
    onSuccess: async (config) => {
      queryClient.setQueryData(CONFIG_QUERY_KEY, config);
      showToast({ message: "Saved cube settings", tone: "info" });
      await queryClient.invalidateQueries({ queryKey: CUBE_QUERY_KEY });
    },
    onError: (error: Error) => {
      showToast({ message: error.message, tone: "error" });
    },
  });

  return (
    <form
      className="settings-section"
      aria-label="Cube"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.success) {
          save.mutate(draft.data);
        }
      }}
    >
      <h3>Cube</h3>
      <p className="muted">
        Saved to <code>cube.config.json</code>.
      </p>
      <label className="field">
        Format
        <select
          value={format}
          onChange={(event) => {
            const next = FORMATS.find((option) => option === event.target.value);
            if (next) {
              setFormat(next);
            }
          }}
        >
          {FORMATS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="field settings-range">
        <legend>Target size</legend>
        <label>
          Min
          <input
            type="number"
            min={1}
            step={1}
            value={min}
            onChange={(event) => {
              setMin(event.target.value);
            }}
          />
        </label>
        <label>
          Max
          <input
            type="number"
            min={1}
            step={1}
            value={max}
            onChange={(event) => {
              setMax(event.target.value);
            }}
          />
        </label>
      </fieldset>
      {!draft.success && (
        <p role="alert" className="error">
          Min and max are whole numbers above 0, and min is no higher than max.
        </p>
      )}
      <button type="submit" disabled={!draft.success || !changed || save.isPending}>
        {save.isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
