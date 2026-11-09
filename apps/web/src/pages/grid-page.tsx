import { mode } from "#mode";
import type { SnapshotCard } from "@repo/cube/browser";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { DEFAULT_ORGANIZER, ORGANIZE_ID, organizers } from "../grid/piles.ts";

function Tile({ card }: { card: SnapshotCard }): ReactNode {
  const mark = mode.useTileMark(card.slug);
  return (
    <li className="tile-cell">
      <Link to="/card/$slug" params={{ slug: card.slug }} className="tile" {...mark}>
        <img src={card.image} alt={card.name} loading="lazy" width={146} height={204} />
      </Link>
      <mode.SelectCard slug={card.slug} name={card.name} />
    </li>
  );
}

export function GridPage(): ReactNode {
  const cube = mode.useCube();
  const { by } = useSearch({ from: "/" });
  const navigate = useNavigate();
  if (!cube) {
    return <p className="muted">Loading cube…</p>;
  }
  const options = organizers(cube);
  const organizer =
    options.find((option) => option.id === by) ??
    options.find((option) => option.id === DEFAULT_ORGANIZER);
  const piles = (organizer?.piles(cube) ?? []).filter(
    (pile) => pile.cards.length > 0 || pile.keepEmpty === true,
  );
  return (
    <div>
      <div className="grid-tools">
        <label>
          Organize by{" "}
          <select
            id={ORGANIZE_ID}
            aria-label="Organize by"
            value={organizer?.id}
            onChange={(event) => {
              const next = event.target.value;
              void navigate({
                to: "/",
                search: next === DEFAULT_ORGANIZER ? {} : { by: next },
              });
            }}
          >
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <mode.BulkBar />
      </div>
      {piles.map((pile) => (
        <section key={pile.id} data-pile={pile.id}>
          <div className="pile-head">
            <mode.SelectPile slugs={pile.cards.map((card) => card.slug)} label={pile.label} />
            <h2>
              {pile.label} <span className="muted">({pile.cards.length})</span>
            </h2>
          </div>
          <ul className="grid">
            {pile.cards.map((card) => (
              <Tile key={card.slug} card={card} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
