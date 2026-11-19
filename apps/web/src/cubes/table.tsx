import type { CompareUnit, GroupRow } from "@repo/cube/browser";
import type { CSSProperties, ReactNode } from "react";
import type { Column } from "./model.ts";
import { OUTLIER, gapLabel, hueOf, percent } from "./model.ts";
import type { StatRow } from "./rows.tsx";

function meanCount(row: GroupRow): number {
  return row.cells.reduce((sum, cell) => sum + cell.count, 0) / Math.max(1, row.cells.length);
}

export function SectionTable({
  title,
  rows,
  specs,
  columns,
  unit,
}: {
  title: string;
  rows: readonly GroupRow[];
  specs: ReadonlyMap<string, StatRow>;
  columns: readonly Column[];
  unit: CompareUnit;
}): ReactNode {
  return (
    <div className="cubes-table-wrap">
      <table className="cubes-table">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Stat</span>
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
            <th scope="col">Average</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const spec = specs.get(row.id);
            return (
              <tr key={row.id}>
                <th scope="row">
                  {spec?.icon}
                  {spec?.label ?? row.id}
                </th>
                {row.cells.map((cell, index) => (
                  <td key={columns[index]?.cube.dir ?? index}>
                    {unit === "share" ? percent(cell.share) : cell.count}
                    {Math.abs(cell.delta) >= OUTLIER && (
                      <span className="cubes-gap" data-dir={cell.delta > 0 ? "more" : "less"}>
                        {gapLabel(cell.delta)}
                      </span>
                    )}
                  </td>
                ))}
                <td className="cubes-avg">
                  {unit === "share" ? percent(row.mean) : meanCount(row).toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
