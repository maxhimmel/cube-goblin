import type { CompareUnit, GroupRow, StatCard, Standout } from "@repo/cube/browser";
import { COLOR_GROUPS, averageManaValue, groupAverage, standouts } from "@repo/cube/browser";
import type { CubeRef } from "@repo/server/events";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { manaVar } from "../forge/lab-charts.tsx";
import type { Matrix, StatRow } from "./rows.tsx";
import { SHAPE_ROWS } from "./rows.tsx";

export const OUTLIER = 0.05;
const STRONG = 0.1;
const PERCENT = 100;
const STANDOUT_COUNT = 5;
const MATRIX_NOTES = 2;
const FOLD_AFTER = 10;

const CUBE_HUES = ["#7c5cff", "#00b3d6", "#ff8a1f", "#ff4f9a", "#22c55e", "#f5c518"];

export interface Column {
  cube: CubeRef;
  cards: StatCard[];
  open: boolean;
}

export function hueOf(index: number): string {
  return CUBE_HUES[index % CUBE_HUES.length] ?? "#7c5cff";
}

function percent(share: number): string {
  return `${String(Math.round(share * PERCENT))}%`;
}

function points(delta: number): string {
  const rounded = Math.round(delta * PERCENT);
  return `${rounded > 0 ? "+" : ""}${String(rounded)} pts`;
}

function direction(delta: number): "more" | "less" | undefined {
  return delta >= OUTLIER ? "more" : delta <= -OUTLIER ? "less" : undefined;
}

function CubeChip({ columns, index }: { columns: readonly Column[]; index: number }): ReactNode {
  return (
    <span className="cubes-chip" style={{ "--hue": hueOf(index) } as CSSProperties}>
      {columns[index]?.cube.name}
    </span>
  );
}

function StandoutLine({
  standout,
  row,
  columns,
}: {
  standout: Standout;
  row: StatRow;
  columns: readonly Column[];
}): ReactNode {
  return (
    <li data-dir={standout.delta > 0 ? "more" : "less"}>
      <CubeChip columns={columns} index={standout.cube} />
      <span>
        {standout.delta > 0 ? "more" : "fewer"} {row.icon} <strong>{row.noun}</strong>:{" "}
        {percent(standout.share)} vs {percent(standout.mean)} average
      </span>
      <span className="cubes-delta">{points(standout.delta)}</span>
    </li>
  );
}

function ColorStrip({ cards }: { cards: readonly StatCard[] }): ReactNode {
  const rows = groupAverage(
    [cards],
    COLOR_GROUPS.map((group) => `color:${group.id}`),
  );
  const total = rows.reduce((sum, row) => sum + (row.cells[0]?.count ?? 0), 0);
  if (total === 0) {
    return null;
  }
  return (
    <span className="cubes-strip" role="img" aria-label="Color mix">
      {rows.map((row) => {
        const count = row.cells[0]?.count ?? 0;
        const id = row.id.split(":")[1] ?? "";
        return count === 0 ? null : (
          <i
            key={row.id}
            title={`${COLOR_GROUPS.find((group) => group.id === id)?.label ?? id}: ${String(count)}`}
            style={{ flexGrow: count, background: manaVar(id) }}
          />
        );
      })}
    </span>
  );
}

function CubeCard({ column, index }: { column: Column; index: number }): ReactNode {
  const [creatures, lands] = groupAverage([column.cards], ["type:creature", "type:land"]);
  const mv = averageManaValue(column.cards);
  return (
    <article
      className="cubes-card"
      style={{ "--hue": hueOf(index) } as CSSProperties}
      aria-label={column.cube.name}
    >
      <header>
        <h3>{column.cube.name}</h3>
        {column.open && <span className="cubes-open">open</span>}
      </header>
      <dl>
        <div>
          <dt>Cards</dt>
          <dd>{column.cards.length}</dd>
        </div>
        <div>
          <dt>Creatures</dt>
          <dd>{percent(creatures?.cells[0]?.share ?? 0)}</dd>
        </div>
        <div>
          <dt>Lands</dt>
          <dd>{percent(lands?.cells[0]?.share ?? 0)}</dd>
        </div>
        <div>
          <dt>Avg MV</dt>
          <dd>{mv === undefined ? "–" : mv.toFixed(2)}</dd>
        </div>
      </dl>
      <ColorStrip cards={column.cards} />
    </article>
  );
}

function lede(columns: readonly Column[], top: Standout | undefined, rows: StatRow[]): string {
  const sizes = columns.map((column) => `${column.cube.name} (${String(column.cards.length)})`);
  const intro = `${String(columns.length)} cubes side by side: ${sizes.join(", ")}.`;
  const row = top && rows.find((entry) => entry.id === top.id);
  if (!top || !row || Math.abs(top.delta) < OUTLIER) {
    return `${intro} They're close: no stat sits more than ${String(OUTLIER * PERCENT)} points from the average.`;
  }
  const name = columns[top.cube]?.cube.name ?? "";
  const verb = top.delta > 0 ? "above" : "below";
  return `${intro} The biggest gap: ${name} at ${percent(top.share)} ${row.noun}, ${String(Math.abs(Math.round(top.delta * PERCENT)))} points ${verb} average.`;
}

export function SummaryHero({
  columns,
  matrices,
}: {
  columns: readonly Column[];
  matrices: readonly Matrix[];
}): ReactNode {
  const allRows = [...SHAPE_ROWS, ...matrices.flatMap((matrix) => matrix.rows)];
  const cubes = columns.map((column) => column.cards);
  const found = standouts(
    groupAverage(
      cubes,
      allRows.map((row) => row.id),
    ),
    OUTLIER,
  );
  const rowOf = new Map(allRows.map((row) => [row.id, row]));
  return (
    <section className="cubes-hero" aria-label="Summary">
      <h2>Summary</h2>
      <p className="cubes-lede">{lede(columns, found[0], allRows)}</p>
      <div className="cubes-cards">
        {columns.map((column, index) => (
          <CubeCard key={column.cube.dir} column={column} index={index} />
        ))}
      </div>
      {found.length > 0 && (
        <>
          <h3 className="cubes-subhead">What stands out</h3>
          <ol className="cubes-standouts" aria-label="What stands out">
            {found.slice(0, STANDOUT_COUNT).map((standout) => {
              const row = rowOf.get(standout.id);
              return row ? (
                <StandoutLine key={standout.id} standout={standout} row={row} columns={columns} />
              ) : null;
            })}
          </ol>
        </>
      )}
    </section>
  );
}

function meanCount(row: GroupRow): number {
  const total = row.cells.reduce((sum, cell) => sum + cell.count, 0);
  return row.cells.length === 0 ? 0 : total / row.cells.length;
}

function countLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function matrixNote(
  found: readonly Standout[],
  rowOf: ReadonlyMap<string, StatRow>,
  columns: readonly Column[],
): ReactNode {
  if (found.length === 0) {
    return `Every cube sits within ${String(OUTLIER * PERCENT)} points of the average here.`;
  }
  return found.slice(0, MATRIX_NOTES).map((standout, index) => {
    const row = rowOf.get(standout.id);
    return (
      <span key={standout.id}>
        {index > 0 && " "}
        <CubeChip columns={columns} index={standout.cube} /> runs{" "}
        {standout.delta > 0 ? "more" : "fewer"} {row?.noun ?? standout.id} (
        {percent(standout.share)} vs {percent(standout.mean)}).
      </span>
    );
  });
}

export function MatrixSection({
  matrix,
  columns,
  unit,
}: {
  matrix: Matrix;
  columns: readonly Column[];
  unit: CompareUnit;
}): ReactNode {
  const computed = groupAverage(
    columns.map((column) => column.cards),
    matrix.rows.map((row) => row.id),
  ).filter((row) => row.cells.some((cell) => cell.count > 0));
  const [showAll, setShowAll] = useState(false);
  if (computed.length === 0) {
    return null;
  }
  const rows = matrix.title === "Tags" ? computed.toSorted((a, b) => b.mean - a.mean) : computed;
  const rowOf = new Map(matrix.rows.map((row) => [row.id, row]));
  const found = standouts(rows, OUTLIER);
  const loud = new Set(found.map((standout) => standout.id));
  const folded = rows.filter((row, index) => index >= FOLD_AFTER && !loud.has(row.id));
  const shown = showAll ? rows : rows.filter((row) => !folded.includes(row));
  const top = Math.max(...rows.flatMap((row) => row.cells.map((cell) => cell.share)), 0.01);
  return (
    <section className="cubes-matrix" aria-label={matrix.title}>
      <header>
        <h2>{matrix.title}</h2>
        <p className="cubes-note">{matrixNote(found, rowOf, columns)}</p>
        <p className="cubes-blurb">{matrix.blurb}</p>
      </header>
      <table>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">{matrix.title}</span>
            </th>
            {columns.map((column, index) => (
              <th
                key={column.cube.dir}
                scope="col"
                style={{ "--hue": hueOf(index) } as CSSProperties}
              >
                {column.cube.name}
              </th>
            ))}
            <th scope="col" className="cubes-avg">
              Average
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => {
            const spec = rowOf.get(row.id);
            const label = spec?.label ?? row.id;
            return (
              <tr key={row.id}>
                <th scope="row">
                  <span className="cubes-row-label">
                    {spec?.icon}
                    {label}
                  </span>
                </th>
                {row.cells.map((cell, index) => {
                  const column = columns[index];
                  const dir = direction(cell.delta);
                  return (
                    <td
                      key={column?.cube.dir ?? index}
                      data-dir={dir}
                      data-strong={Math.abs(cell.delta) >= STRONG ? "" : undefined}
                      title={`${column?.cube.name ?? ""} · ${label}: ${String(cell.count)} cards, ${percent(cell.share)} (average ${percent(row.mean)})`}
                      style={
                        {
                          "--fill": String(cell.share / top),
                          "--bar": spec?.bar ?? "var(--accent)",
                        } as CSSProperties
                      }
                    >
                      <span className="cubes-cell">
                        <span className="cubes-bar" aria-hidden="true" />
                        <span className="cubes-value">
                          {unit === "share" ? percent(cell.share) : cell.count}
                        </span>
                        {dir && <span className="cubes-delta">{points(cell.delta)}</span>}
                      </span>
                    </td>
                  );
                })}
                <td className="cubes-avg">
                  {unit === "share" ? percent(row.mean) : countLabel(meanCount(row))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {folded.length > 0 && (
        <button
          type="button"
          className="cubes-more"
          aria-expanded={showAll}
          onClick={() => {
            setShowAll(!showAll);
          }}
        >
          {showAll ? "Show fewer" : `Show ${String(folded.length)} more, all near the average`}
        </button>
      )}
    </section>
  );
}
