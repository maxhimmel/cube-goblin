import { compileQuery } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useState } from "react";
import { Gauge } from "../gauge.tsx";
import { QueryInput } from "../query/query-input.tsx";
import type { Pill } from "./model.ts";
import type { Lab } from "./use-lab.ts";
import { AXES } from "./use-lab.ts";

export function DraftCount({ lab }: { lab: Lab }): ReactNode {
  const now = lab.scope.length;
  const later = lab.next.length;
  return (
    <div className="lab-count">
      <span className="lab-count-label">Draft</span>
      <strong className="lab-count-value">{now}</strong>
      <span
        className="lab-count-ghost"
        data-up={later > now ? "" : undefined}
        data-idle={later === now ? "" : undefined}
      >
        → {later}
      </span>
      {lab.size && <Gauge count={later} size={lab.size} />}
    </div>
  );
}

function SavePill({ lab, pill }: { lab: Lab; pill: Pill }): ReactNode {
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState("");
  const save = lab.saveFilter;
  if (!save) {
    return null;
  }
  if (!naming) {
    return (
      <button
        type="button"
        className="lab-pill-save"
        title="Keep this as a saved filter"
        onClick={() => {
          setNaming(true);
        }}
      >
        Save
      </button>
    );
  }
  return (
    <form
      className="lab-pill-name"
      onSubmit={(event) => {
        event.preventDefault();
        if (label.trim() !== "") {
          save(label.trim(), pill.key.slice(2), [pill.key]);
        }
      }}
    >
      <input
        aria-label={`Name for ${pill.label}`}
        placeholder="Name"
        value={label}
        autoFocus
        onChange={(event) => {
          setLabel(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setNaming(false);
          }
        }}
        onBlur={() => {
          if (label.trim() === "") {
            setNaming(false);
          }
        }}
      />
    </form>
  );
}

function SaveStack({ save }: { save: (label: string) => void }): ReactNode {
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState("");
  if (!naming) {
    return (
      <button
        type="button"
        className="lab-link"
        title="Save every applied filter as one saved filter"
        onClick={() => {
          setNaming(true);
        }}
      >
        Save as filter
      </button>
    );
  }
  return (
    <form
      className="lab-stack-name"
      onSubmit={(event) => {
        event.preventDefault();
        if (label.trim() !== "") {
          save(label.trim());
        }
      }}
    >
      <input
        aria-label="Name for the applied filters"
        placeholder="Name"
        value={label}
        autoFocus
        onChange={(event) => {
          setLabel(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setNaming(false);
          }
        }}
        onBlur={() => {
          if (label.trim() === "") {
            setNaming(false);
          }
        }}
      />
    </form>
  );
}

function PillBar({ lab }: { lab: Lab }): ReactNode {
  return (
    <div className="lab-pills" role="group" aria-label="Applied filters">
      {lab.pills.length === 0 && lab.typing === "" && (
        <span className="lab-pills-empty">No filter · hover a chart or filter to peek</span>
      )}
      {lab.pills.map((pill) => (
        <span
          key={pill.key}
          className="lab-pill-wrap"
          data-adhoc={pill.key.startsWith("x:") ? "" : undefined}
        >
          <button
            type="button"
            className="lab-pill"
            onClick={() => {
              lab.togglePill(pill.key);
            }}
            onPointerEnter={() => {
              lab.clearPeek();
            }}
            aria-label={`Remove ${pill.label}`}
          >
            {pill.label} <span aria-hidden>×</span>
          </button>
          {pill.key.startsWith("x:") && <SavePill lab={lab} pill={pill} />}
        </span>
      ))}
      {lab.pills.length > 1 && lab.saveStack && <SaveStack save={lab.saveStack} />}
      {lab.pills.length > 1 && (
        <button type="button" className="lab-link" onClick={lab.clearPills}>
          Clear
        </button>
      )}
    </div>
  );
}

export function QueryBar({ lab }: { lab: Lab }): ReactNode {
  const [round, setRound] = useState(0);
  const result = compileQuery(lab.typing);
  const count = result.ok && lab.typing !== "" ? lab.scope.filter(result.test).length : undefined;
  return (
    <div className="lab-query">
      <PillBar lab={lab} />
      <QueryInput
        key={round}
        initial=""
        onChange={(query) => {
          const valid = compileQuery(query).ok;
          lab.setTyping(valid ? query.trim() : lab.typing);
        }}
        vocabulary={lab.vocabulary}
        label="Filter the Forge"
        slashFocus
        status={
          count === undefined
            ? undefined
            : `${String(count)} in draft · Enter applies, then Save on the pill keeps it`
        }
        onSubmit={(next) => {
          if (next.trim() !== "" && compileQuery(next).ok) {
            lab.addPill(`x:${next.trim()}`);
            lab.setTyping("");
            setRound(round + 1);
          }
        }}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: ReactNode }[];
  value: T;
  onChange: (next: T) => void;
}): ReactNode {
  return (
    <div className="lab-seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={option.id === value ? "on" : undefined}
          aria-pressed={option.id === value}
          onClick={() => {
            onChange(option.id);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AxisTabs({ lab }: { lab: Lab }): ReactNode {
  return <Segmented label="Group by" options={AXES} value={lab.axis} onChange={lab.setAxis} />;
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}): ReactNode {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      {label}
    </label>
  );
}
