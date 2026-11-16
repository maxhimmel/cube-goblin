import type { CardStatus, SearchResult, Workbench, WorkbenchCard } from "@repo/cube/browser";
import { CARD_STATUSES, slugify } from "@repo/cube/browser";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { CardImage } from "../card-image.tsx";
import { ManaCost } from "../mana.tsx";
import { queryClient } from "../query-client.ts";
import { CUBE_QUERY_KEY, addCardRequest, searchCards } from "./api.ts";
import { OFFLINE_REASON, useOnline } from "./connection.ts";
import { editsPending } from "./edits.ts";
import { showToast } from "./toast.tsx";

const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

function useDebounced(value: string): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [value]);
  return settled;
}

function ResultTile({
  result,
  action,
  disabled,
  onPick,
}: {
  result: SearchResult;
  action: string;
  disabled: boolean;
  onPick: () => void;
}): ReactNode {
  return (
    <li className="result">
      <CardImage key={result.image} src={result.image} alt={result.name} width={146} height={204} />
      <ManaCost cost={result.manaCost} />
      <span className="muted">{result.typeLine}</span>
      {result.inCube ? (
        <span className="muted">In cube</span>
      ) : (
        <button type="button" disabled={disabled} onClick={onPick}>
          {action} {result.name}
        </button>
      )}
    </li>
  );
}

export function useCloseAdd(): () => void {
  const navigate = useNavigate();
  return () => {
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, add: undefined, replaces: undefined }),
      resetScroll: false,
    });
  };
}

export function AddPanel({
  cube,
  replaces,
}: {
  cube: Workbench | undefined;
  replaces: string | undefined;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const close = useCloseAdd();
  const outgoing = cube?.cards.find((card) => card.slug === replaces);
  const title = outgoing ? `Swap out ${outgoing.name}` : "Add a card";

  useEffect(() => {
    dialog.current?.showModal();
    search.current?.focus();
  }, []);

  return (
    <dialog ref={dialog} className="sheet add-panel" aria-label={title} onClose={close}>
      <header className="sheet-head">
        <h2>{title}</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            dialog.current?.close();
          }}
        >
          ×
        </button>
      </header>
      {!cube ? (
        <p className="muted">Loading cube…</p>
      ) : replaces !== undefined && !outgoing ? (
        <p>Unknown card to swap.</p>
      ) : (
        <AddForm outgoing={outgoing} search={search} />
      )}
    </dialog>
  );
}

function AddForm({
  outgoing,
  search,
}: {
  outgoing: WorkbenchCard | undefined;
  search: RefObject<HTMLInputElement | null>;
}): ReactNode {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CardStatus>(outgoing?.status ?? "prospect");
  const [copyTags, setCopyTags] = useState(true);
  const navigate = useNavigate();
  const settled = useDebounced(query.trim());
  const online = useOnline();
  const enabled = online && settled.length >= MIN_QUERY_LENGTH;
  const results = useQuery({
    queryKey: ["search", settled],
    queryFn: ({ signal }) => searchCards(settled, signal),
    enabled,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const add = useMutation({
    mutationFn: addCardRequest,
    onSuccess: async (card) => {
      showToast({
        message: outgoing
          ? `Swapped ${outgoing.name} for ${card.name}; ${outgoing.name} is now cut`
          : `Added ${card.name}`,
        tone: "info",
      });
      queryClient.removeQueries({ queryKey: ["search"] });
      if (!editsPending()) {
        await queryClient.invalidateQueries({ queryKey: CUBE_QUERY_KEY });
      }
      await navigate({
        to: ".",
        search: (prev) => ({
          ...prev,
          add: undefined,
          replaces: undefined,
          card: slugify(card.name),
        }),
        resetScroll: false,
      });
    },
    onError: (error: Error) => {
      showToast({ message: error.message, tone: "error" });
    },
  });

  return (
    <div className="add-form">
      {outgoing && (
        <p className="muted">
          {outgoing.name} becomes cut and keeps its notes. The new card takes the status below.
        </p>
      )}
      <div className="add-options">
        <fieldset className="field">
          <legend>Status</legend>
          <div className="segmented">
            {CARD_STATUSES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={status === option}
                onClick={() => {
                  setStatus(option);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
        {outgoing && outgoing.tags.length > 0 && (
          <label>
            <input
              type="checkbox"
              checked={copyTags}
              onChange={(event) => {
                setCopyTags(event.target.checked);
              }}
            />{" "}
            Copy tags from {outgoing.name} ({outgoing.tags.length})
          </label>
        )}
      </div>
      <label className="field">
        Search Scryfall
        <input
          type="search"
          aria-label="Search Scryfall"
          placeholder="card name or Scryfall syntax, e.g. o:flying t:dragon"
          value={query}
          ref={search}
          disabled={!online}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </label>
      <div aria-live="polite" className="muted">
        {!online && `${OFFLINE_REASON}, so search and adding cards are off.`}
        {enabled && results.isFetching && "Searching…"}
        {enabled && results.isSuccess && results.data.length === 0 && "No cards found."}
        {online && results.error && <span className="error">{results.error.message}</span>}
      </div>
      {enabled && results.data && (
        <ul className="results" aria-label="Search results">
          {results.data.map((result) => (
            <ResultTile
              key={result.oracleId}
              result={result}
              action={outgoing ? "Swap in" : "Add"}
              disabled={add.isPending || !online}
              onPick={() => {
                add.mutate({
                  oracleId: result.oracleId,
                  status,
                  ...(outgoing ? { replaces: outgoing.slug, copyTags } : {}),
                });
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
