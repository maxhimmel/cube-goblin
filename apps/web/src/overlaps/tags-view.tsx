import { mode } from "#mode";
import type { Tag } from "@repo/cube/browser";
import { parseTagList, tagCounts } from "@repo/cube/browser";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { OverlapResults, considered } from "./overlap.tsx";

export const TAG_MODES = [
  { id: "overlaps", label: "Overlaps" },
  { id: "sketch", label: "Sketch" },
] as const;

export type TagMode = (typeof TAG_MODES)[number]["id"];

export function isTagMode(value: unknown): value is TagMode {
  return TAG_MODES.some((option) => option.id === value);
}

export interface TagLabelProps {
  tag: Tag;
}

function ReadOnlyLabel({ tag }: TagLabelProps): ReactNode {
  return <span className="tag-row-label">{tag.label}</span>;
}

function TagList({
  vocabulary,
  counts,
  picked,
  onPick,
  Label,
  footer,
}: {
  vocabulary: readonly Tag[];
  counts: ReadonlyMap<string, number>;
  picked: readonly string[];
  onPick: (next: string[]) => void;
  Label: (props: TagLabelProps) => ReactNode;
  footer: ReactNode;
}): ReactNode {
  const sorted = vocabulary.toSorted((a, b) => a.label.localeCompare(b.label));
  const empty = sorted.filter((tag) => (counts.get(tag.id) ?? 0) === 0).length;
  return (
    <aside className="tag-rail" aria-label="Tag list">
      <header className="tag-rail-head">
        <h2>Tags</h2>
        <span className="column-count">{vocabulary.length}</span>
        {empty > 0 && <span className="tag-rail-empty">{empty} empty</span>}
      </header>
      <ul className="tag-rows">
        {sorted.map((tag) => {
          const on = picked.includes(tag.id);
          const count = counts.get(tag.id) ?? 0;
          return (
            <li
              key={tag.id}
              className="tag-row"
              data-tag={tag.id}
              data-picked={on || undefined}
              data-empty={count === 0 || undefined}
            >
              <input
                type="checkbox"
                aria-label={`Pick ${tag.label}`}
                checked={on}
                disabled={!on && count === 0}
                onChange={() => {
                  onPick(on ? picked.filter((id) => id !== tag.id) : [...picked, tag.id]);
                }}
              />
              <Label tag={tag} />
              {count === 0 ? (
                <span className="tag-row-flag" title="No draft or prospect card has this tag">
                  empty
                </span>
              ) : (
                <span className="tag-row-count">{count}</span>
              )}
            </li>
          );
        })}
      </ul>
      {footer}
    </aside>
  );
}

export function TagsView({
  sketch,
  Label = ReadOnlyLabel,
  footer = null,
}: {
  sketch?: ReactNode;
  Label?: (props: TagLabelProps) => ReactNode;
  footer?: ReactNode;
}): ReactNode {
  const cube = mode.useCube();
  const search = useSearch({ from: "/tags" });
  const navigate = useNavigate();
  if (!cube) {
    return <p className="muted">Loading cube…</p>;
  }
  const current: TagMode = sketch !== undefined && search.mode === "sketch" ? "sketch" : "overlaps";
  const known = new Set(cube.vocabulary.map((tag) => tag.id));
  const picked = parseTagList(search.tags).filter((tag) => known.has(tag));
  return (
    <section className="tags-view" data-mode={current} aria-labelledby="tags-title">
      <header className="tags-view-head">
        <h1 id="tags-title" className="sr-only">
          Tags
        </h1>
        {sketch !== undefined && (
          <div className="segmented" role="group" aria-label="Tags mode">
            {TAG_MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === current}
                onClick={() => {
                  void navigate({
                    to: "/tags",
                    search: (prev) => ({ ...prev, mode: option.id }),
                  });
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {current === "overlaps" && (
          <p className="muted">Draft and prospect cards. Pick tags to see how they overlap.</p>
        )}
      </header>
      {current === "sketch" ? (
        sketch
      ) : (
        <div className="tags-overlaps">
          <TagList
            vocabulary={cube.vocabulary}
            counts={tagCounts(considered(cube))}
            picked={picked}
            onPick={(next) => {
              void navigate({
                to: "/tags",
                search: (prev) => ({
                  ...prev,
                  tags: next.length > 0 ? next.join(",") : undefined,
                }),
                resetScroll: false,
              });
            }}
            Label={Label}
            footer={footer}
          />
          <OverlapResults cube={cube} picked={picked} />
        </div>
      )}
    </section>
  );
}
