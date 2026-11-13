import type { CardPatch, Tag, WorkbenchCard } from "@repo/cube/browser";
import { CARD_STATUSES } from "@repo/cube/browser";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { sendChanges } from "./api.ts";
import { useCardEdit } from "./edits.ts";
import { PrintingCaption } from "./printing-browser.tsx";
import { TagPicker } from "./tag-picker.tsx";
import { useCreateTag } from "./tags.ts";

const NOTES_DEBOUNCE_MS = 600;

type Save = (label: string, patch: CardPatch, undo: CardPatch) => void;

function NotesField({ slug, notes, save }: { slug: string; notes: string; save: Save }): ReactNode {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const before = useRef<string | undefined>(undefined);
  const latest = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  }, [save]);

  function flush(): void {
    clearTimeout(timer.current);
    const start = before.current;
    const value = latest.current;
    before.current = undefined;
    if (start !== undefined && value !== undefined && value !== start) {
      saveRef.current("notes", { notes: value }, { notes: start });
    }
  }

  useEffect(() => {
    function persistOnExit(): void {
      clearTimeout(timer.current);
      const value = latest.current;
      if (before.current !== undefined && value !== undefined && value !== before.current) {
        before.current = undefined;
        void sendChanges([{ slug, patch: { notes: value } }], true).catch(() => undefined);
      }
    }
    window.addEventListener("pagehide", persistOnExit);
    return () => {
      window.removeEventListener("pagehide", persistOnExit);
      flush();
    };
  }, [slug]);

  return (
    <label className="field">
      Notes
      <textarea
        aria-label="Notes"
        rows={6}
        value={draft ?? notes}
        onChange={(event) => {
          const value = event.target.value;
          before.current ??= draft ?? notes;
          latest.current = value;
          setDraft(value);
          clearTimeout(timer.current);
          timer.current = setTimeout(flush, NOTES_DEBOUNCE_MS);
        }}
        onBlur={() => {
          flush();
          setDraft(undefined);
        }}
      />
    </label>
  );
}

function TagsField({
  slug,
  tags,
  vocabulary,
  save,
}: {
  slug: string;
  tags: string[];
  vocabulary: Tag[];
  save: Save;
}): ReactNode {
  const createTag = useCreateTag();
  return (
    <TagPicker
      legend="Tags"
      inputLabel="Tag name"
      tags={tags}
      vocabulary={vocabulary}
      onAdd={(id) => {
        save("tags", { addTags: [id] }, { removeTags: [id] });
      }}
      onRemove={(id) => {
        save("tags", { removeTags: [id] }, { addTags: [id] });
      }}
      onCreate={(label) => createTag.mutateAsync({ label, addTo: slug })}
    />
  );
}

export function CardPrinting({ card }: { card: WorkbenchCard }): ReactNode {
  const edit = useCardEdit();
  return (
    <PrintingCaption
      card={card}
      save={(label, patch, undo) => {
        edit.mutate({
          label,
          subject: "",
          changes: [{ slug: card.slug, patch }],
          undo: [{ slug: card.slug, patch: undo }],
        });
      }}
    />
  );
}

export function CardEditor({
  card,
  vocabulary,
}: {
  card: WorkbenchCard;
  vocabulary: Tag[];
}): ReactNode {
  const edit = useCardEdit();
  const save: Save = (label, patch, undo) => {
    edit.mutate({
      label,
      subject: "",
      changes: [{ slug: card.slug, patch }],
      undo: [{ slug: card.slug, patch: undo }],
    });
  };

  return (
    <div className="editor">
      <fieldset className="field">
        <legend>Status</legend>
        <div className="segmented">
          {CARD_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={card.status === status}
              onClick={() => {
                if (card.status !== status) {
                  save("status", { status }, { status: card.status });
                }
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </fieldset>
      {card.status !== "cut" && (
        <Link
          to="."
          search={(prev) => ({ ...prev, add: true, replaces: card.slug })}
          resetScroll={false}
        >
          Swap for another card…
        </Link>
      )}
      <TagsField slug={card.slug} tags={card.tags} vocabulary={vocabulary} save={save} />
      <NotesField slug={card.slug} notes={card.notes} save={save} />
    </div>
  );
}
