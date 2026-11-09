import { mode } from "#mode";
import { Link, useNavigate } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { CardImage } from "./card-image.tsx";
import { ManaCost } from "./mana.tsx";

export function useCloseCard(): () => void {
  const navigate = useNavigate();
  return () => {
    void navigate({ to: ".", search: (prev) => ({ ...prev, card: undefined }) });
  };
}

export function CardLink({
  slug,
  className,
  children,
  ...rest
}: {
  slug: string;
  className?: string | undefined;
  children: ReactNode;
} & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "children" | "className" | "target"
>): ReactNode {
  return (
    <Link to="." search={(prev) => ({ ...prev, card: slug })} className={className} {...rest}>
      {children}
    </Link>
  );
}

export function CardPane({ slug }: { slug: string }): ReactNode {
  const cube = mode.useCube();
  const close = useCloseCard();
  const heading = useRef<HTMLHeadingElement>(null);
  const card = cube?.cards.find((candidate) => candidate.slug === slug);

  useEffect(() => {
    heading.current?.focus();
  }, [slug]);

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape" && !event.defaultPrevented) {
        close();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  });

  return (
    <aside className="pane" aria-label={card?.name ?? "Card"}>
      <div className="pane-bar">
        <button type="button" onClick={close}>
          Close
        </button>
      </div>
      {!cube ? (
        <p className="muted">Loading cube…</p>
      ) : !card ? (
        <p ref={heading} tabIndex={-1}>
          Unknown card.
        </p>
      ) : (
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
            <h1 ref={heading} tabIndex={-1}>
              {card.name}
            </h1>
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
      )}
    </aside>
  );
}
