import type { CardSort } from "@repo/cube/browser";
import { CARD_SORTS, isCardSort } from "@repo/cube/browser";
import type { ReactNode } from "react";

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
  const slots = first === "added" || used.size >= CARD_SORTS.length ? chain : [...chain, NONE];
  return (
    <div className="sort-chain" role="group" aria-label="Sort order">
      <label>
        {label}{" "}
        <select
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
      {first === "added" ? (
        <label>
          then{" "}
          <select aria-label="Then by" value={NONE} disabled>
            <option value={NONE}>—</option>
          </select>
        </label>
      ) : (
        slots.map((key, index) => (
          <label key={`${String(index)}-${key}`}>
            then{" "}
            <select
              aria-label={thenLabel(index + 1)}
              value={key}
              onChange={(event) => {
                set(index + 1, event.target.value);
              }}
            >
              <option value={NONE}>—</option>
              {thenOptions(key).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))
      )}
    </div>
  );
}
