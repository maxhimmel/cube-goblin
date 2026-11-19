import { mode } from "#mode";
import type { CompareScope, CompareUnit, GroupRow } from "@repo/cube/browser";
import {
  COMPARE_SCOPES,
  COMPARE_UNITS,
  groupAverage,
  inCompareScope,
  poolTags,
} from "@repo/cube/browser";
import type { CubeRef } from "@repo/server/events";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { z } from "zod";
import { Segmented } from "../forge/toolbar.tsx";
import type { OtherCube } from "../modes/mode.ts";
import { useRemembered } from "../view-choices.ts";
import { Inspector } from "./inspector.tsx";
import type { Column } from "./model.ts";
import {
  MIN_AXES,
  OUTLIER,
  PERCENT,
  biggestGap,
  defaultPins,
  gapCount,
  hueOf,
  isEmpty,
  percent,
  radarIds,
  tells,
} from "./model.ts";
import { RadarHero, RadarTile } from "./radar.tsx";
import type { Section, StatRow } from "./rows.tsx";
import { CUSTOM, FIXED_SECTIONS, tagSection } from "./rows.tsx";
import { SectionTable } from "./table.tsx";

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

type StageView = "radar" | "table";

function statusLine(cube: CubeRef, state: OtherCube | undefined): string | undefined {
  if (state?.status === "failed") {
    return `Couldn't load ${cube.name}: ${state.error}`;
  }
  return state?.status === "loading" ? `Loading ${cube.name}…` : undefined;
}

function Who({ columns, cube }: { columns: readonly Column[]; cube: number }): ReactNode {
  return (
    <span className="cubes-who" style={{ "--hue": hueOf(cube) } as CSSProperties}>
      {columns[cube]?.cube.name}
    </span>
  );
}

function Lede({
  columns,
  rowOf,
  specs,
}: {
  columns: readonly Column[];
  rowOf: ReadonlyMap<string, GroupRow>;
  specs: ReadonlyMap<string, StatRow>;
}): ReactNode {
  const all = tells(columns, rowOf, specs);
  const biggest = biggestGap(rowOf);
  const noun = biggest ? specs.get(biggest.id)?.noun : undefined;
  return (
    <p className="cubes-lede">
      {all.map((tell, index) => (
        <span key={tell.cube}>
          <Who columns={columns} cube={tell.cube} />
          {tell.nouns.length === 0
            ? " sits near the average"
            : ` leans on ${tell.nouns.join(" and ")}`}
          {index < all.length - 1 ? "; " : ". "}
        </span>
      ))}
      {biggest && noun !== undefined && (
        <span className="cubes-muted">
          Biggest gap: {columns[biggest.cube]?.cube.name}&apos;s {noun}, {percent(biggest.share)},{" "}
          {String(Math.round(Math.abs(biggest.delta) * PERCENT))} points{" "}
          {biggest.delta > 0 ? "over" : "under"} the average.
        </span>
      )}
    </p>
  );
}

export function CubesPage(): ReactNode {
  const [choice, setChoice] = useRemembered("cubes.compare", DEFAULT_CHOICE, choiceSchema);
  const [sectionKey, setSectionKey] = useRemembered("cubes.section", "color", z.string());
  const [storedPins, setPins] = useRemembered<string[] | null>(
    "cubes.pins",
    null,
    z.array(z.string()).nullable(),
  );
  const [view, setView] = useRemembered<StageView>(
    "cubes.stage",
    "radar",
    z.enum(["radar", "table"]),
  );
  const [hover, setHover] = useState<string | undefined>(undefined);
  const [last, setLast] = useState<string | undefined>(undefined);
  const [hot, setHot] = useState<number | undefined>(undefined);
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
    ready.map(({ view: cubeView }) => ({
      cards: cubeView.cards.filter((card) => inCompareScope(card, choice.scope)),
      vocabulary: cubeView.vocabulary,
    })),
  );
  const columns: Column[] = ready.map(({ cube }, index) => ({
    cube,
    cards: pooled.cubes[index] ?? [],
    open: cube.dir === list.current.dir,
  }));
  const sections: Section[] = [...FIXED_SECTIONS, tagSection(pooled.tags)];
  const specs = new Map(sections.flatMap((section) => section.rows.map((row) => [row.id, row])));
  const rowOf = new Map(
    groupAverage(
      columns.map((column) => column.cards),
      [...specs.keys()],
    ).map((row) => [row.id, row]),
  );
  const pins = (storedPins ?? defaultPins(rowOf)).filter((id) => rowOf.has(id));
  const pinSet = new Set(pins);
  const togglePin = (id: string): void => {
    setPins(pinSet.has(id) ? pins.filter((other) => other !== id) : [...pins, id]);
  };
  const rowsOf = (ids: readonly string[]): GroupRow[] =>
    ids.flatMap((id) => {
      const row = rowOf.get(id);
      return row ? [row] : [];
    });
  const custom: Section = {
    key: CUSTOM,
    title: "Custom",
    blurb: "The spokes you pinned, from any section.",
    rows: pins.flatMap((id) => specs.get(id) ?? []),
  };
  const stage = [...sections, custom].find((section) => section.key === sectionKey) ?? custom;
  const isCustom = stage.key === CUSTOM;
  const stageIds = isCustom
    ? pins
    : radarIds(
        stage.rows.map((row) => row.id),
        rowOf,
      );
  const tableRows = isCustom
    ? rowsOf(pins)
    : rowsOf(stage.rows.map((row) => row.id)).filter((row) => !isEmpty(row));
  const radarable = stageIds.length >= MIN_AXES;
  const cubes = columns.map((column, index) => ({ name: column.cube.name, hue: hueOf(index) }));
  const inspected = hover ?? last ?? pins[0];
  const toggle = (dir: string, on: boolean): void => {
    setChoice({
      ...choice,
      off: on ? choice.off.filter((other) => other !== dir) : [...choice.off, dir],
    });
  };
  const columnOf = (dir: string): number => columns.findIndex((column) => column.cube.dir === dir);
  const enough = all.length >= 2 && ready.length >= 2;
  const note = isCustom
    ? `${String(pins.length)} pinned spokes`
    : `${String(gapCount(rowsOf(stageIds)))} spokes sit ${String(OUTLIER * PERCENT)}+ points from the average`;
  return (
    <div className="cubes" data-hot={hot}>
      <header className="cubes-bar">
        <h1>Compare cubes</h1>
        <fieldset className="cubes-picker">
          <legend className="sr-only">Cubes</legend>
          {all.map((cube) => {
            const index = columnOf(cube.dir);
            return (
              <label
                key={cube.dir}
                title={cube.dir}
                data-cube={index >= 0 ? index : undefined}
                style={index >= 0 ? ({ "--hue": hueOf(index) } as CSSProperties) : undefined}
                onPointerEnter={() => {
                  setHot(index >= 0 ? index : undefined);
                }}
                onPointerLeave={() => {
                  setHot(undefined);
                }}
              >
                <input
                  type="checkbox"
                  checked={!choice.off.includes(cube.dir)}
                  onChange={(event) => {
                    toggle(cube.dir, event.target.checked);
                  }}
                />
                {cube.name}
                <span className="cubes-muted">
                  {index >= 0 ? (columns[index]?.cards.length ?? "") : ""}
                </span>
              </label>
            );
          })}
        </fieldset>
        <span className="cubes-mean-key">
          <i />
          Average
        </span>
        <span className="cubes-grow" />
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
          <p key={cube.dir} className="cubes-muted" role="status">
            {line}
          </p>
        );
      })}
      {!enough ? (
        <p className="cubes-muted">
          {all.length < 2
            ? "Open or import another cube to compare cubes."
            : "Pick two or more cubes."}
        </p>
      ) : (
        <>
          <Lede columns={columns} rowOf={rowOf} specs={specs} />
          <div className="cubes-body">
            <section className="cubes-stage" aria-label={stage.title}>
              <header>
                <div>
                  <h2>{stage.title}</h2>
                  <p className="cubes-muted">
                    {note}. {stage.blurb}
                  </p>
                </div>
                <Segmented
                  label={`Show ${stage.title} as`}
                  options={[
                    { id: "radar", label: "Radar" },
                    { id: "table", label: "Table" },
                  ]}
                  value={view}
                  onChange={setView}
                />
              </header>
              {view === "table" ? (
                <SectionTable
                  title={stage.title}
                  rows={tableRows}
                  specs={specs}
                  columns={columns}
                  unit={choice.unit}
                />
              ) : radarable ? (
                <RadarHero
                  title={stage.title}
                  rows={rowsOf(stageIds)}
                  specs={specs}
                  cubes={cubes}
                  unit={choice.unit}
                  mixed={isCustom}
                  pins={pinSet}
                  hover={hover}
                  onAxis={(axis) => {
                    setHover(axis);
                    if (axis !== undefined) {
                      setLast(axis);
                    }
                  }}
                  onPin={togglePin}
                  onHotCube={setHot}
                />
              ) : (
                <p className="cubes-empty cubes-stage-empty">
                  {isCustom
                    ? "Pin three or more spokes to draw your Custom radar: click spokes on any section's radar."
                    : "Fewer than three of these have any cards, so there's no shape to draw. The table has the numbers."}
                </p>
              )}
            </section>
            <nav className="cubes-strip" aria-label="Sections">
              {[...sections, custom].map((section) => {
                const ids =
                  section.key === CUSTOM
                    ? pins
                    : radarIds(
                        section.rows.map((row) => row.id),
                        rowOf,
                      );
                const tile = rowsOf(ids);
                return (
                  <button
                    key={section.key}
                    type="button"
                    className="cubes-tile"
                    data-custom={section.key === CUSTOM ? "" : undefined}
                    aria-pressed={section.key === stage.key}
                    onClick={() => {
                      setSectionKey(section.key);
                    }}
                  >
                    <span className="cubes-tile-head">
                      <strong>{section.title}</strong>
                      <small>
                        {section.key === CUSTOM
                          ? `${String(pins.length)} pins`
                          : `${String(gapCount(tile))} gaps`}
                      </small>
                    </span>
                    {tile.length >= MIN_AXES ? (
                      <RadarTile
                        title={section.title}
                        rows={tile}
                        cubes={cubes}
                        unit={choice.unit}
                      />
                    ) : (
                      <span className="cubes-tile-empty">
                        {section.key === CUSTOM ? "Pin 3+ spokes" : "Too few to draw"}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <Inspector
              axis={inspected}
              rowOf={rowOf}
              specs={specs}
              columns={columns}
              unit={choice.unit}
              pins={pins}
              hover={hover}
              onInspect={(axis) => {
                if (axis !== undefined) {
                  setLast(axis);
                }
              }}
              onUnpin={togglePin}
            />
          </div>
        </>
      )}
    </div>
  );
}
