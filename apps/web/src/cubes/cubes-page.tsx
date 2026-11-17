import { mode } from "#mode";
import type { CompareScope, CompareUnit } from "@repo/cube/browser";
import { COMPARE_SCOPES, COMPARE_UNITS, inCompareScope, poolTags } from "@repo/cube/browser";
import type { CubeRef } from "@repo/server/events";
import type { ReactNode } from "react";
import { z } from "zod";
import { Segmented } from "../forge/toolbar.tsx";
import type { OtherCube } from "../modes/mode.ts";
import { useRemembered } from "../view-choices.ts";
import { FIXED_MATRICES, tagMatrix } from "./rows.tsx";
import type { Column } from "./story.tsx";
import { MatrixSection, OUTLIER, SummaryHero } from "./story.tsx";

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
  const columns: Column[] = ready.map(({ cube }, index) => ({
    cube,
    cards: pooled.cubes[index] ?? [],
    open: cube.dir === list.current.dir,
  }));
  const matrices = [...FIXED_MATRICES, tagMatrix(pooled.tags)];
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
          <SummaryHero columns={columns} matrices={matrices} />
          <p className="cubes-legend">
            {`Cells show each cube's ${choice.unit === "share" ? "share of" : "count in"} its ${choice.scope === "draft" ? "draft" : "cards"}. Cells `}
            <span data-dir="more">{OUTLIER * 100}+ points above</span> or{" "}
            <span data-dir="less">below</span> the average stand out.
          </p>
          {matrices.map((matrix) => (
            <MatrixSection
              key={matrix.title}
              matrix={matrix}
              columns={columns}
              unit={choice.unit}
            />
          ))}
        </>
      )}
    </div>
  );
}
