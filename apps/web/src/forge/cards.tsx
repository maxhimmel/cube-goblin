import { mode } from "#mode";
import type { Column } from "@repo/cube/browser";
import { colorKey, columnsBy, sortCards } from "@repo/cube/browser";
import type { CSSProperties, DragEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import { CardImage } from "../card-image.tsx";
import { CardLink } from "../card-pane.tsx";
import { colorIcon, curveTick } from "../insights/labels.tsx";
import { ManaCost } from "../mana.tsx";
import type { GridCard } from "../modes/mode.ts";
import { DRAG_TYPE, previewAt } from "../strip.tsx";
import type { Axis, Lab } from "./use-lab.ts";

const MANA_VAR: Record<string, string> = {
  W: "var(--mana-w)",
  U: "var(--mana-u)",
  B: "var(--mana-b)",
  R: "var(--mana-r)",
  G: "var(--mana-g)",
  M: "var(--mana-m)",
  C: "var(--mana-c)",
};

const COLOR_COLUMN: Record<string, string> = {
  W: "W",
  U: "U",
  B: "B",
  R: "R",
  G: "G",
  C: "colorless",
  M: "multicolored",
};

function stripeOf(card: GridCard): string {
  const key = colorKey(card);
  if (key !== "M") {
    return MANA_VAR[key] ?? "var(--mana-c)";
  }
  return `linear-gradient(180deg, ${card.colors.map((color) => MANA_VAR[color] ?? "").join(", ")})`;
}

function groups(cards: readonly GridCard[], axis: Axis): Column<GridCard>[] {
  return axis === "none"
    ? [{ id: "all", label: "All", cards: [...cards] }]
    : columnsBy(cards, axis);
}

function shownGroups(lab: Lab, cards: readonly GridCard[]): Column<GridCard>[] {
  const shown = cards.filter((card) => !lab.hidden(card));
  return groups(shown, lab.axis)
    .filter((column) => column.cards.length > 0)
    .map((column) => ({ ...column, cards: sortCards(column.cards, lab.sort) }));
}

function GroupTitle({ axis, column }: { axis: Axis; column: Column<GridCard> }): ReactNode {
  if (axis === "mv") {
    return <span className="lab-title-symbol">{curveTick(column.id)}</span>;
  }
  const color = axis === "color" ? COLOR_COLUMN[column.id] : undefined;
  if (color !== undefined) {
    return (
      <span className="lab-title-symbol" title={column.label}>
        {colorIcon(color)}
        {(color === "multicolored" || color === "colorless") && (
          <span className="lab-title-text">{column.label}</span>
        )}
      </span>
    );
  }
  return <span>{column.label}</span>;
}

function litCount(lab: Lab, column: Column<GridCard>, of: string): string {
  const lit = column.cards.filter((card) => !lab.dimmed(card)).length;
  return lit === column.cards.length
    ? String(lit)
    : `${String(lit)}${of}${String(column.cards.length)}`;
}

function tagLabels(lab: Lab, card: GridCard): string[] {
  return card.tags.map((id) => lab.vocabulary.find((tag) => tag.id === id)?.label ?? id);
}

function cardLinkProps(lab: Lab, card: GridCard) {
  return {
    slug: card.slug,
    style: { "--stripe": stripeOf(card) } as CSSProperties,
    draggable: mode.moveCard !== undefined,
    onDragStart: (event: DragEvent<HTMLAnchorElement>) => {
      event.dataTransfer.setData(DRAG_TYPE, card.slug);
      event.dataTransfer.effectAllowed = "move";
    },
    onPointerEnter: (event: PointerEvent<HTMLAnchorElement>) => {
      if (event.pointerType === "mouse") {
        lab.onHover(previewAt(card, event.currentTarget.getBoundingClientRect()));
      }
    },
    onPointerLeave: () => {
      lab.onHover(undefined);
    },
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.altKey) {
        event.preventDefault();
        lab.queue(card);
      }
    },
  };
}

function CardStrip({
  lab,
  card,
  tags,
  removable,
}: {
  lab: Lab;
  card: GridCard;
  tags: boolean;
  removable?: boolean;
}): ReactNode {
  const labels = tags ? tagLabels(lab, card) : [];
  return (
    <li
      className="lab-cell"
      data-dim={lab.dimmed(card) ? "" : undefined}
      data-selected={lab.selected === card.slug ? "" : undefined}
      data-pending={lab.pendingOf(card)}
    >
      <CardLink className="lab-strip" {...cardLinkProps(lab, card)}>
        <span className="lab-strip-top">
          <span className="lab-strip-name">{card.name}</span>
          <ManaCost cost={card.manaCost} />
        </span>
        {labels.length > 0 && (
          <span className="lab-strip-tags">
            {labels.map((tag) => (
              <span key={tag} className="lab-tag">
                {tag}
              </span>
            ))}
          </span>
        )}
      </CardLink>
      {removable && (
        <button
          type="button"
          className="lab-strip-remove"
          aria-label={`Remove ${card.name} from pending`}
          title="Remove from pending"
          onClick={() => {
            lab.onHover(undefined);
            lab.unqueue(card.slug);
          }}
        >
          ×
        </button>
      )}
    </li>
  );
}

export function PendingStrips({
  lab,
  cards,
  tags,
}: {
  lab: Lab;
  cards: readonly GridCard[];
  tags: boolean;
}): ReactNode {
  return (
    <ul className="lab-stack pending-stack">
      {sortCards(cards, lab.sort).map((card) => (
        <CardStrip key={card.slug} lab={lab} card={card} tags={tags} removable />
      ))}
    </ul>
  );
}

export function CardColumns({
  lab,
  cards,
  compact,
  tags,
}: {
  lab: Lab;
  cards: readonly GridCard[];
  compact: boolean;
  tags: boolean;
}): ReactNode {
  const columns = shownGroups(lab, cards);
  return (
    <div
      className="lab-columns"
      data-compact={compact ? "" : undefined}
      data-flow={lab.axis === "none" ? "" : undefined}
      style={{ "--columns": columns.length } as CSSProperties}
    >
      {columns.map((column) => (
        <section key={column.id} className="lab-column">
          <header className="lab-column-head">
            <GroupTitle axis={lab.axis} column={column} />
            <span className="lab-column-count">{litCount(lab, column, "/")}</span>
          </header>
          <ul className="lab-stack">
            {column.cards.map((card) => (
              <CardStrip key={card.slug} lab={lab} card={card} tags={tags} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CardRow({ lab, card }: { lab: Lab; card: GridCard }): ReactNode {
  const tags = tagLabels(lab, card).slice(0, 3);
  const pt = card.power === undefined ? "" : `${card.power}/${card.toughness ?? ""}`;
  return (
    <li
      className="lab-row-cell"
      data-dim={lab.dimmed(card) ? "" : undefined}
      data-selected={lab.selected === card.slug ? "" : undefined}
      data-pending={lab.pendingOf(card)}
    >
      <CardLink className="lab-row" {...cardLinkProps(lab, card)}>
        <span className="lab-row-stripe" />
        <span className="lab-row-cost">
          <ManaCost cost={card.manaCost} />
        </span>
        <span className="lab-row-name">{card.name}</span>
        <span className="lab-row-type">{card.typeLine.split("—")[0]?.trim()}</span>
        <span className="lab-row-pt">{pt}</span>
        <span className="lab-row-tags">
          {tags.map((tag) => (
            <span key={tag} className="lab-tag">
              {tag}
            </span>
          ))}
        </span>
      </CardLink>
    </li>
  );
}

export function CardRows({ lab, cards }: { lab: Lab; cards: readonly GridCard[] }): ReactNode {
  return shownGroups(lab, cards).map((column) => (
    <div key={column.id} className="lab-group">
      <header className="lab-group-head">
        <GroupTitle axis={lab.axis} column={column} />
        <span className="lab-group-count">{litCount(lab, column, " of ")}</span>
      </header>
      <ul className="lab-rows">
        {column.cards.map((card) => (
          <CardRow key={card.slug} lab={lab} card={card} />
        ))}
      </ul>
    </div>
  ));
}

function CardTile({ lab, card }: { lab: Lab; card: GridCard }): ReactNode {
  const mark = mode.useTileMark(card.slug);
  return (
    <li
      className="lab-tile-cell"
      data-dim={lab.dimmed(card) ? "" : undefined}
      data-pending={lab.pendingOf(card)}
    >
      <CardLink className="tile lab-image" {...cardLinkProps(lab, card)} {...mark}>
        <CardImage key={card.image} src={card.image} alt={card.name} width={146} height={204} />
      </CardLink>
      <mode.SelectCard slug={card.slug} name={card.name} />
    </li>
  );
}

export function CardImages({
  lab,
  cards,
  compact,
}: {
  lab: Lab;
  cards: readonly GridCard[];
  compact: boolean;
}): ReactNode {
  return (
    <div className="lab-images" data-compact={compact ? "" : undefined}>
      {shownGroups(lab, cards).map((column) => (
        <section key={column.id} className="lab-group">
          <header className="lab-group-head">
            <mode.SelectPile
              slugs={column.cards.map((card) => card.slug)}
              label={`${column.label}${compact ? " prospects" : ""}`}
            />
            <GroupTitle axis={lab.axis} column={column} />
            <span className="lab-group-count">{litCount(lab, column, " of ")}</span>
          </header>
          <ul className="lab-image-grid">
            {column.cards.map((card) => (
              <CardTile key={card.slug} lab={lab} card={card} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
