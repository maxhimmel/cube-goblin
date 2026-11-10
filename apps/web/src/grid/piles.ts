import type { SnapshotCard, TagKind } from "@repo/cube/browser";
import { CARD_STATUSES, TAG_KINDS, TYPE_COLUMNS, typeKeys } from "@repo/cube/browser";
import type { CubeView, GridCard } from "../modes/mode.ts";

export interface Pile {
  id: string;
  label: string;
  cards: SnapshotCard[];
  keepEmpty?: boolean;
}

export interface Organizer {
  id: string;
  label: string;
  piles: (cube: CubeView) => Pile[];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function overview(cube: CubeView): Pile[] {
  const live = cube.cards.filter((card) => card.status !== "cut");
  return [
    {
      id: "draft",
      label: "Draft",
      cards: live.filter((card) => card.status === "draft"),
      keepEmpty: true,
    },
    {
      id: "prospect",
      label: "Prospects",
      cards: live.filter((card) => card.status === "prospect"),
    },
    { id: "cut", label: "Cut", cards: cube.cards.filter((card) => card.status === "cut") },
  ];
}

function byStatus(cube: CubeView): Pile[] {
  return CARD_STATUSES.map((status) => ({
    id: status,
    label: capitalize(status),
    cards: cube.cards.filter((card) => card.status === status),
  }));
}

function byType(cube: CubeView): Pile[] {
  return TYPE_COLUMNS.map(({ id, label }) => ({
    id: `type-${id}`,
    label,
    cards: cube.cards.filter((card) => typeKeys(card).includes(id)),
  }));
}

function hasTag(card: GridCard, id: string): boolean {
  return card.tags?.includes(id) ?? false;
}

function byTagKind(kind: TagKind): (cube: CubeView) => Pile[] {
  return (cube) => {
    const tags = cube.vocabulary.filter((tag) => tag.kind === kind);
    return [
      ...tags.map((tag) => ({
        id: `tag-${tag.id}`,
        label: tag.label,
        cards: cube.cards.filter((card) => hasTag(card, tag.id)),
      })),
      {
        id: `no-${kind}`,
        label: `No ${kind}`,
        cards: cube.cards.filter((card) => !tags.some((tag) => hasTag(card, tag.id))),
      },
    ];
  };
}

export const DEFAULT_ORGANIZER = "overview";
export const ORGANIZE_ID = "organize-by";

export function organizers(cube: CubeView): Organizer[] {
  return [
    { id: DEFAULT_ORGANIZER, label: "Overview", piles: overview },
    { id: "status", label: "Status", piles: byStatus },
    { id: "type", label: "Card type", piles: byType },
    ...TAG_KINDS.filter((kind) => cube.vocabulary.some((tag) => tag.kind === kind)).map((kind) => ({
      id: kind,
      label: capitalize(kind),
      piles: byTagKind(kind),
    })),
  ];
}
