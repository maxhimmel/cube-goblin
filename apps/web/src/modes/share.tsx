import type { ReactNode } from "react";
import { useState } from "react";
import { snapshot } from "../data.ts";
import { LogView } from "../log/log-view.tsx";
import { Menu } from "../menu.tsx";
import { TagsView } from "../overlaps/tags-view.tsx";
import {
  downloadSavedDocument,
  reviewCode,
  setReviewer,
  toggleVote,
  updateCard,
  useMoves,
  useReview,
} from "../review-store.ts";
import { scopeStorage } from "../storage-scope.ts";
import type { CubeView, Mode } from "./mode.ts";
import { ShareSettings } from "./share-settings.tsx";

scopeStorage(snapshot.id);

const view: CubeView = {
  cards: snapshot.cards,
  vocabulary: snapshot.vocabulary,
};

const NO_SELECTION: ReadonlySet<string> = new Set();

function ReviewMenu(): ReactNode {
  const review = useReview();
  const [code, setCode] = useState<string | undefined>(undefined);
  const reviewed = Object.keys(review.cards).length;
  const moves = review.moves.length;
  const total = reviewed + moves;
  return (
    <Menu
      label={
        <>
          Review
          {total > 0 && <span className="review-badge">{total}</span>}
        </>
      }
      listLabel="Review"
    >
      <div className="review-menu">
        <label className="field">
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
        <p className="muted">
          <span data-testid="reviewed-count">{reviewed} reviewed</span> ·{" "}
          <span data-testid="moves-count">
            {moves} {moves === 1 ? "move" : "moves"}
          </span>
        </p>
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
        {code !== undefined && <textarea aria-label="Review code" readOnly value={code} rows={3} />}
        <button type="button" onClick={downloadSavedDocument}>
          Save copy to send back
        </button>
        <p className="muted review-snapshot">snapshot {snapshot.id}</p>
      </div>
    </Menu>
  );
}

function Toolbar(): ReactNode {
  return (
    <div className="topbar-actions">
      <ReviewMenu />
      <ShareSettings />
    </div>
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
  usePending: useMoves,
  useFilters: () => snapshot.filters,
  useLayouts: () => undefined,
  name: "share",
  useCube: () => view,
  useTileMark: (slug) => ({ "data-vote": useReview().cards[slug]?.vote ?? undefined }),
  Toolbar,
  CardPanel,
  CardImageCaption: () => null,
  TagsPage: () => <TagsView />,
  HistoryPage: () => <LogView entries={snapshot.log} />,
  SelectCard: () => null,
  SelectPile: () => null,
  BulkBar: () => null,
  useSelection: () => NO_SELECTION,
  AddPanel: () => null,
};
