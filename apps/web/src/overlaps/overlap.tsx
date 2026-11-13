import type { Overlap, Tag } from "@repo/cube/browser";
import {
  cardCount,
  describeFilter,
  overlapFilter,
  overlapKey,
  tagLabel as label,
  tagOverlaps,
} from "@repo/cube/browser";
import { Link, useNavigate } from "@tanstack/react-router";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useId, useState } from "react";
import { z } from "zod";
import type { CubeView, GridCard } from "../modes/mode.ts";
import { useRemembered } from "../view-choices.ts";
import type { VennLayout } from "./geometry.ts";
import { VENN_LAYOUTS, inside } from "./geometry.ts";

const SET_HUES = ["var(--set-1)", "var(--set-2)", "var(--set-3)"];

function describe(
  tags: readonly string[],
  picked: readonly string[],
  vocabulary: readonly Tag[],
): string {
  return describeFilter(overlapFilter(picked, tags), vocabulary);
}

function forgeSearch(
  picked: readonly string[],
  tags: readonly string[],
  keep: boolean,
): { q: string; keep?: true } {
  const filter = overlapFilter(picked, tags);
  return {
    q: [
      ...filter.with.map((tag) => `tag:${tag}`),
      ...filter.without.map((tag) => `-tag:${tag}`),
    ].join(" "),
    ...(keep ? { keep: true as const } : {}),
  };
}

function indexKey(picked: readonly string[], tags: readonly string[]): string {
  return overlapKey(tags.map((tag) => String(picked.indexOf(tag))));
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
  keep,
}: {
  picked: readonly string[];
  overlaps: readonly Overlap<GridCard>[];
  vocabulary: readonly Tag[];
  keep: boolean;
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
            void navigate({ to: "/", search: forgeSearch(picked, tagsOf(key), keep) });
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
      <figcaption className="muted">
        {hovered === undefined
          ? keep
            ? "Click a region to add its filter in Forge."
            : "Click a region to filter Forge to its cards."
          : `${describe(hovered, picked, vocabulary)} · ${cardCount(counts.get(hover ?? "")?.cards.length ?? 0)}`}
      </figcaption>
    </figure>
  );
}

function OverlapTable({
  picked,
  overlaps,
  vocabulary,
  keep,
}: {
  picked: readonly string[];
  overlaps: readonly Overlap<GridCard>[];
  vocabulary: readonly Tag[];
  keep: boolean;
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
                        role="img"
                        aria-label={on ? label(tag, vocabulary) : `not ${label(tag, vocabulary)}`}
                      />
                    </td>
                  );
                })}
              <td className="overlap-count">
                <Link
                  to="/"
                  search={forgeSearch(picked, overlap.tags, keep)}
                  aria-label={`${describe(overlap.tags, picked, vocabulary)}: ${cardCount(count)}`}
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

export function OverlapResults({
  cube,
  picked,
}: {
  cube: CubeView;
  picked: readonly string[];
}): ReactNode {
  const overlaps = tagOverlaps(considered(cube), picked);
  const [keep, setKeep] = useRemembered("tags.keepForgeFilters", false, z.boolean());
  if (picked.length === 0) {
    return (
      <p className="muted overlap-hint">
        Pick two or three tags for a Venn diagram, or more for the table. Each card counts in one
        overlap only.
      </p>
    );
  }
  return (
    <div className="overlap-results">
      <label className="overlap-keep">
        <input
          type="checkbox"
          checked={keep}
          onChange={(event) => {
            setKeep(event.target.checked);
          }}
        />
        Keep Forge&apos;s other filters when opening an overlap
      </label>
      <div className="overlap-body">
        {(picked.length === 2 || picked.length === 3) && (
          <Venn picked={picked} overlaps={overlaps} vocabulary={cube.vocabulary} keep={keep} />
        )}
        <OverlapTable
          picked={picked}
          overlaps={overlaps}
          vocabulary={cube.vocabulary}
          keep={keep}
        />
      </div>
    </div>
  );
}

export function considered(cube: CubeView): GridCard[] {
  return cube.cards.filter((card) => card.status !== "cut");
}
