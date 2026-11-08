import { mode } from "#mode";
import type { SnapshotCard } from "@repo/cube/browser";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { CubeView } from "../modes/mode.ts";

interface Group {
  id: string;
  label: string;
  cards: SnapshotCard[];
}

function groups(cube: CubeView): Group[] {
  const live = cube.cards.filter((card) => card.status !== "cut");
  return [
    { id: "draft", label: "Draft", cards: live.filter((card) => card.status === "draft") },
    ...cube.sections.map((section) => ({
      id: section.id,
      label: `Prospects: ${section.label}`,
      cards: live.filter((card) => card.status !== "draft" && card.section === section.id),
    })),
    {
      id: "prospects-other",
      label: "Prospects: other",
      cards: live.filter(
        (card) =>
          card.status === "prospect" &&
          !cube.sections.some((section) => section.id === card.section),
      ),
    },
    { id: "cut", label: "Cut", cards: cube.cards.filter((card) => card.status === "cut") },
  ].filter((group) => group.cards.length > 0 || group.id === "draft");
}

function Tile({ card }: { card: SnapshotCard }): ReactNode {
  const mark = mode.useTileMark(card.slug);
  return (
    <li>
      <Link to="/card/$slug" params={{ slug: card.slug }} className="tile" {...mark}>
        <img src={card.image} alt={card.name} loading="lazy" width={146} height={204} />
      </Link>
    </li>
  );
}

export function GridPage(): ReactNode {
  const cube = mode.useCube();
  if (!cube) {
    return <p className="muted">Loading cube…</p>;
  }
  return (
    <div>
      {groups(cube).map((group) => (
        <section key={group.id} data-group={group.id}>
          <h2>
            {group.label} <span className="muted">({group.cards.length})</span>
          </h2>
          <ul className="grid">
            {group.cards.map((card) => (
              <Tile key={card.slug} card={card} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
