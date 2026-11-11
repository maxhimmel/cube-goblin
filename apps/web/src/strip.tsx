import { mode } from "#mode";
import { colorKey } from "@repo/cube/browser";
import type { CSSProperties, DragEvent, PointerEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { CardLink } from "./card-pane.tsx";
import { ManaCost } from "./mana.tsx";
import type { GridCard } from "./modes/mode.ts";

const PREVIEW_WIDTH = 250;
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH * 680) / 488);
const GAP = 14;
export const DRAG_TYPE = "application/x-cube-card";
export const SECTION_DRAG_TYPE = "application/x-cube-section";

const MANA_VAR: Record<string, string> = {
  W: "var(--mana-w)",
  U: "var(--mana-u)",
  B: "var(--mana-b)",
  R: "var(--mana-r)",
  G: "var(--mana-g)",
};

function stripe(card: GridCard): string {
  const key = colorKey(card);
  if (key === "C") {
    return "var(--mana-c)";
  }
  if (key !== "M") {
    return MANA_VAR[key] ?? "var(--mana-c)";
  }
  const stops = card.colors.map((color) => MANA_VAR[color] ?? "var(--mana-c)");
  return `linear-gradient(180deg, ${stops.join(", ")})`;
}

export interface Hover {
  card: GridCard;
  style: CSSProperties;
}

function previewAt(card: GridCard, rect: DOMRect): Hover {
  const right = rect.right + GAP;
  const left = right + PREVIEW_WIDTH <= window.innerWidth ? right : rect.left - GAP - PREVIEW_WIDTH;
  const top = Math.min(
    Math.max(8, rect.top - PREVIEW_HEIGHT / 3),
    window.innerHeight - PREVIEW_HEIGHT - 8,
  );
  return { card, style: { left: Math.max(8, left), top } };
}

export function Strip({
  card,
  onHover,
  dragFrom,
  after,
}: {
  card: GridCard;
  onHover: (hover: Hover | undefined) => void;
  dragFrom?: string;
  after?: ReactNode;
}): ReactNode {
  return (
    <li className="strip-cell" data-status={card.status}>
      <CardLink
        slug={card.slug}
        className="strip"
        style={{ "--stripe": stripe(card) } as CSSProperties}
        draggable={mode.moveCard !== undefined}
        onDragStart={(event: DragEvent<HTMLAnchorElement>) => {
          event.dataTransfer.setData(DRAG_TYPE, card.slug);
          if (dragFrom !== undefined) {
            event.dataTransfer.setData(SECTION_DRAG_TYPE, dragFrom);
          }
          event.dataTransfer.effectAllowed = "copyMove";
          onHover(undefined);
        }}
        onPointerEnter={(event: PointerEvent<HTMLAnchorElement>) => {
          if (event.pointerType === "mouse") {
            onHover(previewAt(card, event.currentTarget.getBoundingClientRect()));
          }
        }}
        onPointerLeave={() => {
          onHover(undefined);
        }}
        onFocus={(event) => {
          onHover(previewAt(card, event.currentTarget.getBoundingClientRect()));
        }}
        onBlur={() => {
          onHover(undefined);
        }}
      >
        <span className="strip-name">{card.name}</span>
        <ManaCost cost={card.manaCost} />
      </CardLink>
      {after}
    </li>
  );
}

export function Preview({ hover }: { hover: Hover | undefined }): ReactNode {
  return (
    hover &&
    createPortal(
      <img
        key={hover.card.slug}
        className="preview"
        src={hover.card.imageLarge}
        alt=""
        width={PREVIEW_WIDTH}
        height={PREVIEW_HEIGHT}
        style={hover.style}
      />,
      document.body,
    )
  );
}
