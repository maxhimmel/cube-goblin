import type { CardSort } from "@repo/cube/browser";
import { CARD_SORTS, isCardSort } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useState } from "react";

const NONE = "";

function thenLabel(index: number): string {
  return index === 1 ? "Then by" : `Then by, key ${String(index + 1)}`;
}

export function SortChain({
  keys,
  onChange,
  label = "Sort cards by",
  first: firstDefault = "added",
}: {
  keys: readonly CardSort[];
  onChange: (keys: CardSort[]) => void;
  label?: string;
  first?: CardSort;
}): ReactNode {
  const [adding, setAdding] = useState(false);
  const [first = firstDefault, ...rest] = keys;
  const chain = first === "added" ? [] : rest;
  const used = new Set<string>([first, ...chain]);
  const set = (index: number, value: string): void => {
    const all = [first, ...chain];
    const next = isCardSort(value)
      ? all
          .map((key, at) => (at === index ? value : key))
          .concat(index === all.length ? [value] : [])
      : all.filter((_, at) => at !== index);
    onChange([...new Set(next)]);
  };
  const thenOptions = (current: string | undefined) =>
    CARD_SORTS.filter(
      (option) => option.id !== "added" && (option.id === current || !used.has(option.id)),
    );
  const canAdd = first !== "added" && used.size < CARD_SORTS.length;
  const select = (index: number, value: string, autoFocus = false): ReactNode => (
    <select
      className="sort-chain-key"
      aria-label={thenLabel(index)}
      value={value}
      autoFocus={autoFocus}
      onChange={(event) => {
        set(index, event.target.value);
        setAdding(false);
      }}
      onBlur={() => {
        if (autoFocus) {
          setAdding(false);
        }
      }}
    >
      <option value={NONE}>{autoFocus ? "Pick a key…" : "— remove"}</option>
      {thenOptions(value).map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
  return (
    <div className="sort-chain" role="group" aria-label="Sort order">
      <label>
        <span className="sort-chain-word">{label}</span>
        <select
          className="sort-chain-key"
          aria-label={label}
          value={first}
          onChange={(event) => {
            set(0, event.target.value);
          }}
        >
          {CARD_SORTS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {chain.map((key, index) => (
        <label key={`${String(index)}-${key}`}>
          <span className="sort-chain-word">then</span>
          {select(index + 1, key)}
        </label>
      ))}
      {canAdd &&
        (adding ? (
          <label>
            <span className="sort-chain-word">then</span>
            {select(chain.length + 1, NONE, true)}
          </label>
        ) : (
          <button
            type="button"
            className="sort-chain-add"
            onClick={() => {
              setAdding(true);
            }}
          >
            + then
          </button>
        ))}
    </div>
  );
}

export function SortMenu({
  keys,
  onChange,
}: {
  keys: readonly CardSort[];
  onChange: (keys: CardSort[]) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const names = keys.map((key) => CARD_SORTS.find((option) => option.id === key)?.label ?? key);
  return (
    <div
      className="sort-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="sort-menu-button"
        aria-expanded={open}
        aria-label={`Sort: ${names.join(", ") || "Added"}`}
        onClick={() => {
          setOpen(!open);
        }}
      >
        <span aria-hidden>⇅</span> {names.join(", ") || "Added"}
      </button>
      {open && (
        <div className="sort-menu-panel">
          <SortChain keys={keys} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
