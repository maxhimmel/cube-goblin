import type { Tag, TagKind, Workbench } from "@repo/cube/browser";
import { TAG_KINDS } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useState } from "react";
import { useChangeTag, useCreateTag } from "./tags.ts";

const KIND_LABELS: Record<TagKind, string> = { archetype: "Archetypes", group: "Groups" };

function TagRow({ tag, count }: { tag: Tag; count: number }): ReactNode {
  const changeTag = useChangeTag();
  const [label, setLabel] = useState<string | undefined>(undefined);

  function commit(): void {
    const next = label?.trim();
    setLabel(undefined);
    if (next && next !== tag.label) {
      changeTag.mutate({ id: tag.id, label: next });
    }
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
      <td>
        <select
          aria-label={`Kind for ${tag.id}`}
          value={tag.kind}
          onChange={(event) => {
            changeTag.mutate({ id: tag.id, kind: event.target.value as TagKind });
          }}
        >
          {TAG_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </td>
      <td className="muted">{tag.id}</td>
      <td>{count}</td>
    </tr>
  );
}

function NewTagForm(): ReactNode {
  const createTag = useCreateTag();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<TagKind>("group");
  return (
    <form
      className="inline"
      onSubmit={(event) => {
        event.preventDefault();
        if (label.trim()) {
          createTag.mutate(
            { label: label.trim(), kind },
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
      <select
        aria-label="New tag kind"
        value={kind}
        onChange={(event) => {
          setKind(event.target.value as TagKind);
        }}
      >
        {TAG_KINDS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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
  const counts = new Map<string, number>();
  for (const card of cube.cards) {
    for (const tag of card.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return (
    <div className="tags-page">
      <h1>Tags</h1>
      <p className="muted">
        Renaming changes the label only. Cards keep the tag id, so no card files change.
      </p>
      <NewTagForm />
      {TAG_KINDS.map((kind) => {
        const tags = cube.vocabulary.filter((tag) => tag.kind === kind);
        return (
          <section key={kind} data-kind={kind}>
            <h2>
              {KIND_LABELS[kind]} <span className="muted">({tags.length})</span>
            </h2>
            {tags.length === 0 ? (
              <p className="muted">None yet.</p>
            ) : (
              <table className="tag-table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Kind</th>
                    <th>Id</th>
                    <th>Cards</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tag) => (
                    <TagRow key={tag.id} tag={tag} count={counts.get(tag.id) ?? 0} />
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
