import type { Workbench } from "@repo/cube/browser";
import type { ReactNode } from "react";
import { useState } from "react";
import type { TagLabelProps } from "../overlaps/tags-view.tsx";
import { TagsView } from "../overlaps/tags-view.tsx";
import { BoardPage } from "./board-page.tsx";
import { useChangeTag, useCreateTag } from "./tags.ts";

function EditableLabel({ tag }: TagLabelProps): ReactNode {
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
    <input
      className="tag-row-label tag-row-input"
      aria-label={`Label for ${tag.id}`}
      title={`Id ${tag.id}: renaming changes the label only, so no card files change`}
      value={label ?? tag.label}
      onChange={(event) => {
        setLabel(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setLabel(undefined);
        }
      }}
    />
  );
}

function NewTagForm(): ReactNode {
  const createTag = useCreateTag();
  const [label, setLabel] = useState("");
  return (
    <form
      className="tag-rail-new"
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
        placeholder="New tag…"
      />
      <button type="submit" disabled={createTag.isPending || label.trim() === ""}>
        Create tag
      </button>
    </form>
  );
}

export function TagsPage({ cube }: { cube: Workbench | undefined }): ReactNode {
  return (
    <TagsView sketch={<BoardPage cube={cube} />} Label={EditableLabel} footer={<NewTagForm />} />
  );
}
