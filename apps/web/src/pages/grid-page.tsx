import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { snapshot } from "../data.ts";
import { useReview } from "../review-store.ts";

const GROUPS = [
  { id: "draft", label: "Draft" },
  ...snapshot.sections.map((section) => ({ id: section.id, label: `Prospects: ${section.label}` })),
];

export function GridPage(): ReactNode {
  const review = useReview();
  return (
    <div>
      {GROUPS.map((group) => {
        const cards = snapshot.cards.filter((card) =>
          group.id === "draft" ? card.status === "draft" : card.section === group.id,
        );
        return (
          <section key={group.id}>
            <h2>
              {group.label} <span className="muted">({cards.length})</span>
            </h2>
            <ul className="grid">
              {cards.map((card) => {
                const vote = review.cards[card.slug]?.vote;
                return (
                  <li key={card.slug}>
                    <Link
                      to="/card/$slug"
                      params={{ slug: card.slug }}
                      className="tile"
                      data-vote={vote ?? undefined}
                    >
                      <img
                        src={card.image}
                        alt={card.name}
                        loading="lazy"
                        width={146}
                        height={204}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
