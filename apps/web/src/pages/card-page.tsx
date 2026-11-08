import { Link, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cardsBySlug } from "../data.ts";
import { toggleVote, updateCard, useReview } from "../review-store.ts";

export function CardPage(): ReactNode {
  const { slug } = useParams({ from: "/card/$slug" });
  const review = useReview();
  const card = cardsBySlug.get(slug);
  if (!card) {
    return (
      <p>
        Unknown card. <Link to="/">Back</Link>
      </p>
    );
  }
  const mine = review.cards[slug];

  return (
    <article className="detail">
      <img src={card.imageLarge} alt={card.name} className="large" width={336} height={468} />
      <div className="detail-body">
        <Link to="/">← all cards</Link>
        <h1>{card.name}</h1>
        <p className="muted">
          {card.manaCost} · {card.typeLine}
        </p>
        <p className="oracle">{card.oracleText}</p>
        <a href={card.scryfallUri} target="_blank" rel="noreferrer">
          Scryfall
        </a>
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
      </div>
    </article>
  );
}
