import { mode } from "#mode";
import type { CompareScope, CompareUnit, GroupRow } from "@repo/cube/browser";
import {
  COLORS,
  COLOR_GROUPS,
  COMPARE_SCOPES,
  COMPARE_UNITS,
  CURVE_COLUMNS,
  TYPE_COLUMNS,
  groupAverage,
  inCompareScope,
  poolTags,
} from "@repo/cube/browser";
import type { CubeRef } from "@repo/server/events";
import type { CSSProperties, ReactNode } from "react";
import { z } from "zod";
import { Segmented } from "../forge/toolbar.tsx";
import type { OtherCube } from "../modes/mode.ts";
import { useRemembered } from "../view-choices.ts";

interface Choice {
  off: string[];
  scope: CompareScope;
  unit: CompareUnit;
}

const DEFAULT_CHOICE: Choice = { off: [], scope: "draft", unit: "share" };

const choiceSchema: z.ZodType<Choice> = z.object({
  off: z.array(z.string()).catch([]),
  scope: z.enum(COMPARE_SCOPES).catch("draft"),
  unit: z.enum(COMPARE_UNITS).catch("share"),
});

const SCOPE_LABEL: Record<CompareScope, string> = {
  draft: "Draft",
  all: "+ prospects & cut",
};

const UNIT_LABEL: Record<CompareUnit, string> = {
  share: "Shares",
  count: "Counts",
};

interface Row {
  id: string;
  label: string;
}

interface Section {
  title: string;
  rows: Row[];
}

const FIXED_SECTIONS: Section[] = [
  {
    title: "Summary",
    rows: [
      { id: "cards", label: "Cards" },
      { id: "nonland", label: "Nonland" },
      { id: "type:land", label: "Lands" },
      { id: "type:creature", label: "Creatures" },
    ],
  },
  {
    title: "Curve",
    rows: CURVE_COLUMNS.map((column) => ({
      id: `curve:${column.id}`,
      label: `MV ${column.label}`,
    })),
  },
  {
    title: "Color",
    rows: COLOR_GROUPS.map((group) => ({ id: `color:${group.id}`, label: group.label })),
  },
  {
    title: "Card types",
    rows: TYPE_COLUMNS.map((column) => ({ id: `type:${column.id}`, label: column.label })),
  },
  {
    title: "Heavy pips",
    rows: COLORS.map((color) => ({ id: `heavy:${color.id}`, label: color.label })),
  },
];

const FULL_TINT_AT = 0.1;
const PERCENT = 100;

function percent(share: number): string {
  return `${String(Math.round(share * PERCENT))}%`;
}

function meanCount(row: GroupRow): number {
  const total = row.cells.reduce((sum, cell) => sum + cell.count, 0);
  return row.cells.length === 0 ? 0 : total / row.cells.length;
}

function countLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function SectionTable({
  section,
  rows,
  cubes,
  unit,
}: {
  section: Section;
  rows: GroupRow[];
  cubes: CubeRef[];
  unit: CompareUnit;
}): ReactNode {
  const labelOf = new Map(section.rows.map((row) => [row.id, row.label]));
  const shown = rows.filter((row) => row.cells.some((cell) => cell.count > 0));
  if (shown.length === 0) {
    return null;
  }
  return (
    <section className="cubes-section" aria-label={section.title}>
      <h2>{section.title}</h2>
      <table className="stat-table cubes-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">{section.title}</span>
            </th>
            {cubes.map((cube) => (
              <th key={cube.dir} scope="col">
                {cube.name}
              </th>
            ))}
            <th scope="col">Average</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => {
            const label = labelOf.get(row.id) ?? row.id;
            return (
              <tr key={row.id}>
                <th scope="row">{label}</th>
                {row.cells.map((cell, index) => {
                  const cube = cubes[index];
                  const name = cube?.name ?? "";
                  const tint = Math.min(1, Math.abs(cell.delta) / FULL_TINT_AT);
                  return (
                    <td
                      key={cube?.dir ?? index}
                      data-dir={cell.delta > 0 ? "more" : cell.delta < 0 ? "less" : undefined}
                      style={{ "--tint": String(tint) } as CSSProperties}
                      title={`${name} · ${label}: ${String(cell.count)} cards, ${percent(cell.share)} (average ${percent(row.mean)})`}
                    >
                      {unit === "share" ? percent(cell.share) : cell.count}
                    </td>
                  );
                })}
                <td className="cubes-mean">
                  {unit === "share" ? percent(row.mean) : countLabel(meanCount(row))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function statusLine(cube: CubeRef, state: OtherCube | undefined): string | undefined {
  if (state?.status === "failed") {
    return `Couldn't load ${cube.name}: ${state.error}`;
  }
  return state?.status === "loading" ? `Loading ${cube.name}…` : undefined;
}

export function CubesPage(): ReactNode {
  const [choice, setChoice] = useRemembered("cubes.compare", DEFAULT_CHOICE, choiceSchema);
  const list = mode.useCubeList?.();
  const all = list
    ? [list.current, ...list.recent.filter((cube) => cube.dir !== list.current.dir)]
    : [];
  const picked = all.filter((cube) => !choice.off.includes(cube.dir));
  const states = mode.useCubesAt?.(picked.map((cube) => cube.dir)) ?? [];
  if (!mode.useCubeList) {
    return <p className="muted">Comparing cubes works in the workbench only.</p>;
  }
  if (!list) {
    return <p className="muted">Loading cubes…</p>;
  }
  const ready = picked.flatMap((cube, index) => {
    const state = states[index];
    return state?.status === "ready" ? [{ cube, view: state.cube }] : [];
  });
  const pooled = poolTags(
    ready.map(({ view }) => ({
      cards: view.cards.filter((card) => inCompareScope(card, choice.scope)),
      vocabulary: view.vocabulary,
    })),
  );
  const columns = ready.map(({ cube }) => cube);
  const sections: Section[] = [
    ...FIXED_SECTIONS,
    { title: "Tags", rows: pooled.tags.map((tag) => ({ id: `tag:${tag.id}`, label: tag.label })) },
  ];
  const toggle = (dir: string, on: boolean): void => {
    setChoice({
      ...choice,
      off: on ? choice.off.filter((other) => other !== dir) : [...choice.off, dir],
    });
  };
  return (
    <div className="cubes">
      <header className="cubes-controls">
        <h1>Compare cubes</h1>
        <fieldset className="cubes-picker">
          <legend>Cubes</legend>
          {all.map((cube) => (
            <label key={cube.dir} title={cube.dir}>
              <input
                type="checkbox"
                checked={!choice.off.includes(cube.dir)}
                onChange={(event) => {
                  toggle(cube.dir, event.target.checked);
                }}
              />
              {cube.name}
              {cube.dir === list.current.dir && <span className="muted"> (open)</span>}
            </label>
          ))}
        </fieldset>
        <Segmented
          label="Cards"
          options={COMPARE_SCOPES.map((id) => ({ id, label: SCOPE_LABEL[id] }))}
          value={choice.scope}
          onChange={(scope) => {
            setChoice({ ...choice, scope });
          }}
        />
        <Segmented
          label="Numbers"
          options={COMPARE_UNITS.map((id) => ({ id, label: UNIT_LABEL[id] }))}
          value={choice.unit}
          onChange={(unit) => {
            setChoice({ ...choice, unit });
          }}
        />
      </header>
      {picked.map((cube, index) => {
        const line = statusLine(cube, states[index]);
        return line === undefined ? null : (
          <p key={cube.dir} className="muted" role="status">
            {line}
          </p>
        );
      })}
      {all.length < 2 ? (
        <p className="muted">Open or import another cube to compare cubes.</p>
      ) : ready.length < 2 ? (
        <p className="muted">Pick two or more cubes.</p>
      ) : (
        <>
          <p className="muted cubes-legend">
            {`Each cell is that cube's ${choice.unit === "share" ? "share of" : "count in"} its ${choice.scope === "draft" ? "draft" : "cards"}, tinted by share `}
            <span data-dir="more">above</span> or <span data-dir="less">below</span> the average of
            the picked cubes.
          </p>
          <div className="cubes-sections">
            {sections.map((section) => {
              const rows = groupAverage(
                pooled.cubes,
                section.rows.map((row) => row.id),
              );
              const sorted =
                section.title === "Tags" ? rows.toSorted((a, b) => b.mean - a.mean) : rows;
              return (
                <SectionTable
                  key={section.title}
                  section={section}
                  rows={sorted}
                  cubes={columns}
                  unit={choice.unit}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
