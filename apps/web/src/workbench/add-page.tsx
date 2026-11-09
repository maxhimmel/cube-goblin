import type { CardStatus, SearchResult, Workbench, WorkbenchCard } from "@repo/cube/browser";
import { CARD_STATUSES, slugify } from "@repo/cube/browser";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { queryClient } from "../query-client.ts";
import { CUBE_QUERY_KEY, addCardRequest, searchCards } from "./api.ts";
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
      <img src={result.image} alt={result.name} loading="lazy" width={146} height={204} />
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

export function AddPage({
  cube,
  replaces,
}: {
  cube: Workbench | undefined;
  replaces: string | undefined;
}): ReactNode {
  const outgoing: WorkbenchCard | undefined = cube?.cards.find((card) => card.slug === replaces);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CardStatus>(outgoing?.status ?? "prospect");
  const [section, setSection] = useState(outgoing?.section ?? "");
  const [copyTags, setCopyTags] = useState(true);
  const navigate = useNavigate();
  const settled = useDebounced(query.trim());
  const enabled = settled.length >= MIN_QUERY_LENGTH;
  const results = useQuery({
    queryKey: ["search", settled],
    queryFn: ({ signal }) => searchCards(settled, signal),
    enabled,
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
      await navigate({ to: "/card/$slug", params: { slug: slugify(card.name) } });
    },
    onError: (error: Error) => {
      showToast({ message: error.message, tone: "error" });
    },
  });

  if (!cube) {
    return <p className="muted">Loading cube…</p>;
  }
  if (replaces !== undefined && !outgoing) {
    return (
      <p>
        Unknown card to swap. <Link to="/">Back</Link>
      </p>
    );
  }

  return (
    <div className="add-page">
      <Link to="/">← all cards</Link>
      <h1>{outgoing ? `Swap out ${outgoing.name}` : "Add a card"}</h1>
      {outgoing && (
        <p className="muted">
          {outgoing.name} becomes cut and keeps its notes. The new card takes the status and section
          below.
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
        <label className="field">
          Section
          <select
            aria-label="Section"
            value={section}
            onChange={(event) => {
              setSection(event.target.value);
            }}
          >
            <option value="">none</option>
            {cube.sections.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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
          autoFocus
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </label>
      <div aria-live="polite" className="muted">
        {enabled && results.isFetching && "Searching…"}
        {enabled && results.isSuccess && results.data.length === 0 && "No cards found."}
        {results.error && <span className="error">{results.error.message}</span>}
      </div>
      {enabled && results.data && (
        <ul className="results" aria-label="Search results">
          {results.data.map((result) => (
            <ResultTile
              key={result.oracleId}
              result={result}
              action={outgoing ? "Swap in" : "Add"}
              disabled={add.isPending}
              onPick={() => {
                add.mutate({
                  oracleId: result.oracleId,
                  status,
                  ...(section ? { section } : {}),
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
