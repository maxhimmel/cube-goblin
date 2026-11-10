import type { ReactNode } from "react";
import { useState } from "react";
import { snapshot } from "../data.ts";
import {
  downloadSavedDocument,
  reviewCode,
  setReviewer,
  toggleVote,
  updateCard,
  useReview,
} from "../review-store.ts";
import type { CubeView, Mode } from "./mode.ts";

const view: CubeView = {
  cards: snapshot.cards,
  sections: snapshot.sections,
  vocabulary: [],
  label: `snapshot ${snapshot.id}`,
  functionsAsOf: snapshot.functionsAsOf,
};

const NO_SELECTION: ReadonlySet<string> = new Set();

function Toolbar(): ReactNode {
  const review = useReview();
  const [code, setCode] = useState<string | undefined>(undefined);
  const reviewed = Object.keys(review.cards).length;

  return (
    <>
      <label className="reviewer">
        Your name
        <input
          aria-label="Your name"
          value={review.reviewer}
          onChange={(event) => {
            setReviewer(event.target.value);
          }}
          placeholder="who's reviewing?"
        />
      </label>
      <span className="muted" data-testid="reviewed-count">
        {reviewed} reviewed
      </span>
      <button type="button" onClick={downloadSavedDocument}>
        Save copy to send back
      </button>
      <button
        type="button"
        onClick={() => {
          const next = reviewCode();
          setCode(next);
          if (window.isSecureContext) {
            void navigator.clipboard.writeText(next).catch(() => undefined);
          }
        }}
      >
        Copy review code
      </button>
      {code !== undefined && (
        <div className="code-panel">
          <textarea aria-label="Review code" readOnly value={code} rows={3} />
          <button
            type="button"
            onClick={() => {
              setCode(undefined);
            }}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}

function CardPanel({ slug }: { slug: string }): ReactNode {
  const review = useReview();
  const mine = review.cards[slug];
  return (
    <>
      <div className="votes">
        {(["keep", "cut"] as const).map((vote) => (
          <button
            key={vote}
            type="button"
            aria-pressed={mine?.vote === vote}
            onClick={() => {
              toggleVote(slug, vote);
            }}
          >
            {vote}
          </button>
        ))}
      </div>
      <label>
        Comment
        <textarea
          aria-label="Comment"
          value={mine?.comment ?? ""}
          onChange={(event) => {
            updateCard(slug, { comment: event.target.value });
          }}
          rows={5}
        />
      </label>
    </>
  );
}

export const mode: Mode = {
  name: "share",
  useCube: () => view,
  useTileMark: (slug) => ({ "data-vote": useReview().cards[slug]?.vote ?? undefined }),
  Toolbar,
  CardPanel,
  TagsPage: () => <p className="muted">Tags are edited in the workbench.</p>,
  BoardPage: () => <p className="muted">The board lives in the workbench.</p>,
  SelectCard: () => null,
  SelectPile: () => null,
  BulkBar: () => null,
  useSelection: () => NO_SELECTION,
  AddPage: () => <p className="muted">Cards are added in the workbench.</p>,
};
