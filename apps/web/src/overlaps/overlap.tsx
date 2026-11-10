import { mode } from "#mode";
import type { Overlap, Tag } from "@repo/cube/browser";
import {
  TAG_KINDS,
  overlapFilter,
  overlapKey,
  parseTagList,
  tagOverlaps,
} from "@repo/cube/browser";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useId, useState } from "react";
import type { GridCard } from "../modes/mode.ts";
import type { VennLayout } from "./geometry.ts";
import { VENN_LAYOUTS, inside } from "./geometry.ts";

const KIND_LABELS: Record<(typeof TAG_KINDS)[number], string> = {
  archetype: "Archetypes",
  group: "Groups",
};

const SET_HUES = ["var(--set-1)", "var(--set-2)", "var(--set-3)"];

function label(id: string, vocabulary: readonly Tag[]): string {
  return vocabulary.find((tag) => tag.id === id)?.label ?? id;
}

function describe(tags: readonly string[], picked: readonly string[], vocabulary: readonly Tag[]) {
  if (tags.length === 0) {
    return "None of these tags";
  }
  const names = tags.map((id) => label(id, vocabulary)).join(" + ");
  const rest = picked.filter((id) => !tags.includes(id));
  return rest.length === 0
    ? names
    : `${names}, not ${rest.map((id) => label(id, vocabulary)).join(" or ")}`;
}

function wallSearch(picked: readonly string[], tags: readonly string[]) {
  const filter = overlapFilter(picked, tags);
  return {
    ...(filter.with.length > 0 ? { with: filter.with.join(",") } : {}),
    ...(filter.without.length > 0 ? { without: filter.without.join(",") } : {}),
  };
}

function indexKey(picked: readonly string[], tags: readonly string[]): string {
  return overlapKey(tags.map((tag) => String(picked.indexOf(tag))));
}

function TagPicker({
  vocabulary,
  counts,
  picked,
  onChange,
}: {
  vocabulary: readonly Tag[];
  counts: ReadonlyMap<string, number>;
  picked: readonly string[];
  onChange: (next: string[]) => void;
}): ReactNode {
  return (
    <div className="overlap-picker">
      {TAG_KINDS.map((kind) => {
        const tags = vocabulary.filter((tag) => tag.kind === kind);
        if (tags.length === 0) {
          return null;
        }
        return (
          <div
            key={kind}
            className="overlap-picker-kind"
            role="group"
            aria-label={KIND_LABELS[kind]}
          >
            <span className="muted">{KIND_LABELS[kind]}</span>
            {tags.map((tag) => {
              const on = picked.includes(tag.id);
              const count = counts.get(tag.id) ?? 0;
              return (
                <button
                  key={tag.id}
                  type="button"
                  className="overlap-tag"
                  aria-pressed={on}
                  disabled={!on && count === 0}
                  onClick={() => {
                    onChange(on ? picked.filter((id) => id !== tag.id) : [...picked, tag.id]);
                  }}
                >
                  {tag.label} <span className="muted">{count}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function svgPoint(event: MouseEvent<SVGSVGElement>): { x: number; y: number } | undefined {
  const matrix = event.currentTarget.getScreenCTM();
  if (!matrix) {
    return undefined;
  }
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

function regionAt(layout: VennLayout, x: number, y: number): string | undefined {
  const members = layout.circles
    .map((circle, index) => (inside(circle, x, y) ? String(index) : undefined))
    .filter((index) => index !== undefined);
  return members.length === 0 ? undefined : overlapKey(members);
}

function Region({ layout, regionKey, id }: { layout: VennLayout; regionKey: string; id: string }) {
  const included = regionKey.split("+").map(Number);
  const excluded = layout.circles.map((_, index) => index).filter((i) => !included.includes(i));
  const mask = `${id}-mask`;
  const shape = (
    <rect
      className="venn-highlight"
      width={layout.width}
      height={layout.height}
      mask={`url(#${mask})`}
    />
  );
  return (
    <>
      <mask id={mask}>
        <rect width={layout.width} height={layout.height} fill="white" />
        {excluded.map((index) => {
          const circle = layout.circles[index];
          return circle && <circle key={index} {...circle} fill="black" />;
        })}
      </mask>
      {included.reduce<ReactNode>(
        (inner, index) => (
          <g clipPath={`url(#${id}-clip-${String(index)})`}>{inner}</g>
        ),
        shape,
      )}
    </>
  );
}

function Venn({
  picked,
  overlaps,
  vocabulary,
}: {
  picked: readonly string[];
  overlaps: readonly Overlap<GridCard>[];
  vocabulary: readonly Tag[];
}): ReactNode {
  const navigate = useNavigate();
  const id = useId().replace(/[^a-zA-Z0-9]/gu, "");
  const [hover, setHover] = useState<string | undefined>(undefined);
  const layout = VENN_LAYOUTS[picked.length === 2 ? 2 : 3];
  const counts = new Map(overlaps.map((overlap) => [indexKey(picked, overlap.tags), overlap]));
  const tagsOf = (key: string): string[] =>
    key.split("+").flatMap((index) => picked[Number(index)] ?? []);
  const hovered = hover === undefined ? undefined : tagsOf(hover);

  return (
    <figure className="venn">
      <svg
        viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`}
        role="img"
        aria-label={`Venn diagram of ${picked.map((tag) => label(tag, vocabulary)).join(", ")}. The table lists every overlap.`}
        data-region={hover}
        onPointerMove={(event) => {
          const point = svgPoint(event);
          setHover(point && regionAt(layout, point.x, point.y));
        }}
        onPointerLeave={() => {
          setHover(undefined);
        }}
        onClick={(event) => {
          const point = svgPoint(event);
          const key = point && regionAt(layout, point.x, point.y);
          if (key !== undefined) {
            void navigate({ to: "/", search: wallSearch(picked, tagsOf(key)) });
          }
        }}
      >
        <defs>
          {layout.circles.map((circle, index) => (
            <clipPath key={index} id={`${id}-clip-${String(index)}`}>
              <circle {...circle} />
            </clipPath>
          ))}
        </defs>
        {layout.circles.map((circle, index) => (
          <circle
            key={index}
            {...circle}
            className="venn-set"
            style={{ "--set": SET_HUES[index] } as CSSProperties}
          />
        ))}
        {hover !== undefined && <Region layout={layout} regionKey={hover} id={id} />}
        {layout.names.map((name, index) => (
          <text key={index} className="venn-name" x={name.x} y={name.y} textAnchor={name.anchor}>
            {label(picked[index] ?? "", vocabulary)}
          </text>
        ))}
        {Object.entries(layout.counts).map(([key, point]) => {
          const count = counts.get(key)?.cards.length ?? 0;
          return (
            <text
              key={key}
              className="venn-count"
              data-empty={count === 0}
              data-key={key}
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {count}
            </text>
          );
        })}
      </svg>
      <figcaption className="muted" aria-live="polite">
        {hovered === undefined
          ? "Click a region to show its cards on the Wall."
          : `${describe(hovered, picked, vocabulary)} · ${String(counts.get(hover ?? "")?.cards.length ?? 0)} cards`}
      </figcaption>
    </figure>
  );
}

function OverlapTable({
  picked,
  overlaps,
  vocabulary,
}: {
  picked: readonly string[];
  overlaps: readonly Overlap<GridCard>[];
  vocabulary: readonly Tag[];
}): ReactNode {
  const most = Math.max(1, ...overlaps.map((overlap) => overlap.cards.length));
  const hued = picked.length <= SET_HUES.length;
  return (
    <table className="overlap-table" data-wide={picked.length > 3}>
      <thead>
        <tr>
          {picked.map((tag, index) => (
            <th key={tag} scope="col" className="overlap-tag-head">
              <span>
                {hued && <i className="overlap-swatch" style={{ background: SET_HUES[index] }} />}
                {label(tag, vocabulary)}
              </span>
            </th>
          ))}
          <th scope="col">Cards</th>
        </tr>
      </thead>
      <tbody>
        {overlaps.map((overlap) => {
          const count = overlap.cards.length;
          return (
            <tr key={overlap.key} data-overlap={overlap.key}>
              {overlap.tags.length === 0 && (
                <td colSpan={picked.length} className="overlap-none muted">
                  none of these
                </td>
              )}
              {overlap.tags.length > 0 &&
                picked.map((tag, index) => {
                  const on = overlap.tags.includes(tag);
                  return (
                    <td key={tag} className="overlap-dot-cell">
                      <span
                        className="overlap-dot"
                        data-on={on}
                        style={on && hued ? { background: SET_HUES[index] } : undefined}
                        aria-label={on ? label(tag, vocabulary) : `not ${label(tag, vocabulary)}`}
                      />
                    </td>
                  );
                })}
              <td className="overlap-count">
                <Link
                  to="/"
                  search={wallSearch(picked, overlap.tags)}
                  aria-label={`${describe(overlap.tags, picked, vocabulary)}: ${String(count)} cards`}
                >
                  <span
                    className="overlap-bar"
                    style={{ width: `${String((count / most) * 100)}%` }}
                  />
                  <span className="overlap-number">{count}</span>
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function TagOverlap(): ReactNode {
  const cube = mode.useCube();
  const search = useSearch({ from: "/tags" });
  const navigate = useNavigate();
  if (!cube) {
    return <p className="muted">Loading cube…</p>;
  }
  const cards = cube.cards.filter((card) => card.status !== "cut");
  const known = new Set(cube.vocabulary.map((tag) => tag.id));
  const picked = parseTagList(search.tags).filter((tag) => known.has(tag));
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const tag of card.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const overlaps = tagOverlaps(cards, picked);

  return (
    <section className="overlap" aria-labelledby="overlap-title">
      <h1 id="overlap-title">Tag overlaps</h1>
      <p className="muted">
        Draft and prospect cards. Pick tags to see how they overlap; each card counts in one overlap
        only.
      </p>
      <TagPicker
        vocabulary={cube.vocabulary}
        counts={counts}
        picked={picked}
        onChange={(next) => {
          void navigate({
            to: "/tags",
            search: (prev) => ({ ...prev, tags: next.length > 0 ? next.join(",") : undefined }),
            resetScroll: false,
          });
        }}
      />
      {picked.length === 0 ? (
        <p className="muted">Pick two or three tags for a Venn diagram, or more for the table.</p>
      ) : (
        <div className="overlap-body">
          {(picked.length === 2 || picked.length === 3) && (
            <Venn picked={picked} overlaps={overlaps} vocabulary={cube.vocabulary} />
          )}
          <OverlapTable picked={picked} overlaps={overlaps} vocabulary={cube.vocabulary} />
        </div>
      )}
    </section>
  );
}
