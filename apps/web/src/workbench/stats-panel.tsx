import type { Count, Workbench, WorkbenchCard } from "@repo/cube/browser";
import { TAG_KINDS, cubeStats } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useState } from "react";
import { ManaSymbol, manaClass } from "../mana.tsx";
import { useSelection } from "./selection.ts";

interface Scope {
  id: string;
  label: string;
  includes: (card: WorkbenchCard, selection: ReadonlySet<string>) => boolean;
}

const SCOPES: Scope[] = [
  { id: "draft", label: "Draft", includes: (card) => card.status === "draft" },
  {
    id: "considered",
    label: "Draft + prospects",
    includes: (card) => card.status !== "cut",
  },
  { id: "all", label: "All cards", includes: () => true },
  { id: "selected", label: "Selected", includes: (card, selection) => selection.has(card.slug) },
];

const COLOR_SYMBOLS: Record<string, string> = { multicolored: "multicolor", colorless: "C" };

function CountTable({
  caption,
  rows,
  head,
}: {
  caption: string;
  rows: Count[];
  head?: (row: Count) => ReactNode;
}): ReactNode {
  return (
    <table className="stat-table">
      <caption>{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} data-stat={row.id}>
            <th scope="row">{head ? head(row) : row.label}</th>
            <td>{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function colorHead(row: Count): ReactNode {
  const symbol = COLOR_SYMBOLS[row.id] ?? row.id;
  return (
    <>
      <i
        className={symbol === "multicolor" ? "ms ms-multicolor" : `ms ${manaClass(symbol)} ms-cost`}
        aria-hidden="true"
      />{" "}
      {row.label}
    </>
  );
}

function SizeLine({ cube }: { cube: Workbench }): ReactNode {
  const drafted = cube.cards.filter((card) => card.status === "draft").length;
  const { min, max } = cube.size;
  const verdict =
    drafted > max
      ? `${String(drafted - max)} over`
      : drafted < min
        ? `${String(min - drafted)} under`
        : "on target";
  return (
    <p className="stat-size" data-testid="draft-size">
      <strong>{drafted}</strong> in draft · target {min}–{max} ·{" "}
      <span data-verdict={drafted > max ? "over" : drafted < min ? "under" : "ok"}>{verdict}</span>
    </p>
  );
}

export function StatsPanel({ cube }: { cube: Workbench | undefined }): ReactNode {
  const selection = useSelection();
  const [scopeId, setScopeId] = useState("draft");
  if (!cube) {
    return null;
  }
  const scope = SCOPES.find((option) => option.id === scopeId) ?? SCOPES[0];
  const cards = scope ? cube.cards.filter((card) => scope.includes(card, selection)) : cube.cards;
  const stats = cubeStats(cards, cube.vocabulary);
  return (
    <aside className="stats" aria-label="Cube stats">
      <details open>
        <summary>
          <h2>Stats</h2>
        </summary>
        <SizeLine cube={cube} />
        <label>
          Count{" "}
          <select
            aria-label="Count cards in"
            value={scopeId}
            onChange={(event) => {
              setScopeId(event.target.value);
            }}
          >
            {SCOPES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.id === "selected"
                  ? `${option.label} (${String(selection.size)})`
                  : option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="muted" data-testid="stats-total">
          {stats.total} {stats.total === 1 ? "card" : "cards"}
        </p>
        <p className="muted" data-testid="stats-lands">
          {stats.lands} {stats.lands === 1 ? "land" : "lands"}; color and mana value count the rest
        </p>
        {scopeId !== "draft" && <CountTable caption="Status" rows={stats.status} />}
        <CountTable caption="Color" rows={stats.colors} head={colorHead} />
        <CountTable
          caption="Mana value"
          rows={stats.curve}
          head={(row) => (
            <>
              <ManaSymbol symbol={row.id} label={row.id} />
              {row.label.endsWith("+") && "+"}
            </>
          )}
        />
        {TAG_KINDS.map((kind) => {
          const rows = stats.tags.filter((row) => row.kind === kind);
          return (
            rows.length > 0 && (
              <CountTable
                key={kind}
                caption={kind === "archetype" ? "Archetypes" : "Groups"}
                rows={rows}
              />
            )
          );
        })}
      </details>
    </aside>
  );
}
