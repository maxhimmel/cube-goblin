import type { Tag, Workbench } from "@repo/cube/browser";
import { tagCounts } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useState } from "react";
import { TagOverlap } from "../overlaps/overlap.tsx";
import { useChangeTag, useCreateTag } from "./tags.ts";

function TagRow({ tag, count }: { tag: Tag; count: number }): ReactNode {
  const changeTag = useChangeTag();
  const [label, setLabel] = useState<string | undefined>(undefined);

  function commit(): void {
    const next = label?.trim();
    if (!next || next === tag.label) {
      setLabel(undefined);
      return;
    }
    changeTag.mutate(
      { id: tag.id, label: next },
      {
        onSettled: () => {
          setLabel(undefined);
        },
      },
    );
  }

  return (
    <tr data-tag={tag.id}>
      <td>
        <input
          aria-label={`Label for ${tag.id}`}
          value={label ?? tag.label}
          onChange={(event) => {
            setLabel(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit();
            }
          }}
        />
      </td>
      <td className="muted">{tag.id}</td>
      <td>{count}</td>
    </tr>
  );
}

function NewTagForm(): ReactNode {
  const createTag = useCreateTag();
  const [label, setLabel] = useState("");
  return (
    <form
      className="inline"
      onSubmit={(event) => {
        event.preventDefault();
        if (label.trim()) {
          createTag.mutate(
            { label: label.trim() },
            {
              onSuccess: () => {
                setLabel("");
              },
            },
          );
        }
      }}
    >
      <input
        aria-label="New tag label"
        value={label}
        onChange={(event) => {
          setLabel(event.target.value);
        }}
        placeholder="new tag"
      />
      <button type="submit" disabled={createTag.isPending}>
        Create tag
      </button>
    </form>
  );
}

export function TagsPage({ cube }: { cube: Workbench | undefined }): ReactNode {
  if (!cube) {
    return <p className="muted">Loading cube…</p>;
  }
  const counts = tagCounts(cube.cards);
  return (
    <div className="tags-page">
      <TagOverlap />
      <h2>Manage tags</h2>
      <p className="muted">
        Renaming changes the label only. Cards keep the tag id, so no card files change.
      </p>
      <NewTagForm />
      <table className="tag-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Id</th>
            <th>All cards</th>
          </tr>
        </thead>
        <tbody>
          {cube.vocabulary.map((tag) => (
            <TagRow key={tag.id} tag={tag} count={counts.get(tag.id) ?? 0} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
