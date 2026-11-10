import type { CardStatus, SnapshotCard, Tag } from "@repo/cube/browser";
import type { ReactNode } from "react";

export type GridCard = SnapshotCard;

export interface CubeView {
  cards: GridCard[];
  vocabulary: Tag[];
  label: string;
  size?: { min: number; max: number } | undefined;
}

export interface Mode {
  name: "share" | "workbench";
  useCube: () => CubeView | undefined;
  useTileMark: (slug: string) => Record<string, string | undefined>;
  Toolbar: () => ReactNode;
  CardPanel: (props: { slug: string }) => ReactNode;
  CardImageCaption: (props: { slug: string }) => ReactNode;
  TagsPage: () => ReactNode;
  BoardPage: () => ReactNode;
  VersionsPage: () => ReactNode;
  SelectCard: (props: { slug: string; name: string }) => ReactNode;
  SelectPile: (props: { slugs: string[]; label: string }) => ReactNode;
  BulkBar: () => ReactNode;
  useSelection: () => ReadonlySet<string>;
  AddPage: (props: { replaces: string | undefined }) => ReactNode;
  moveCard?: (card: GridCard, status: CardStatus) => void;
}
