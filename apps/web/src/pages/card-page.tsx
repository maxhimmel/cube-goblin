import { mode } from "#mode";
import { Link, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CardImage } from "../card-image.tsx";
import { ManaCost } from "../mana.tsx";

export function CardPage(): ReactNode {
  const { slug } = useParams({ from: "/card/$slug" });
  const cube = mode.useCube();
  if (!cube) {
    return <p className="muted">Loading cube…</p>;
  }
  const card = cube.cards.find((candidate) => candidate.slug === slug);
  if (!card) {
    return (
      <p>
        Unknown card. <Link to="/">Back</Link>
      </p>
    );
  }

  return (
    <article className="detail">
      <CardImage
        key={card.imageLarge}
        src={card.imageLarge}
        alt={card.name}
        className="large"
        width={336}
        height={468}
        lazy={false}
      />
      <div className="detail-body">
        <Link to="/">← all cards</Link>
        <h1>{card.name}</h1>
        <p className="muted">
          <ManaCost cost={card.manaCost} /> {card.manaCost && "· "}
          {card.typeLine}
        </p>
        <p className="oracle">{card.oracleText}</p>
        <a href={card.scryfallUri} target="_blank" rel="noreferrer">
          Scryfall
        </a>
        <mode.CardPanel slug={slug} />
      </div>
    </article>
  );
}
