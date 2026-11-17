import type {
  CardStatus,
  Filter,
  Layout,
  PendingMoveEntry,
  SnapshotCard,
  Tag,
} from "@repo/cube/browser";
import type { CubeRef } from "@repo/server/events";
import type { ReactNode } from "react";

export type GridCard = SnapshotCard;

export interface CubeView {
  cards: GridCard[];
  vocabulary: Tag[];
  size?: { min: number; max: number } | undefined;
}

export type OtherCube =
  { status: "loading" } | { status: "failed"; error: string } | { status: "ready"; cube: CubeView };

export interface Mode {
  name: "share" | "workbench";
  boot: () => Promise<void>;
  CubeSwitcher: () => ReactNode;
  useCube: () => CubeView | undefined;
  useOtherCubes?: () => CubeRef[] | undefined;
  useOtherCube?: (dir: string | undefined) => OtherCube | undefined;
  useTileMark: (slug: string) => Record<string, string | undefined>;
  Toolbar: () => ReactNode;
  CardPanel: (props: { slug: string }) => ReactNode;
  CardImageCaption: (props: { slug: string }) => ReactNode;
  TagsPage: () => ReactNode;
  HistoryPage: () => ReactNode;
  SelectCard: (props: { slug: string; name: string }) => ReactNode;
  SelectPile: (props: { slugs: string[]; label: string }) => ReactNode;
  BulkBar: () => ReactNode;
  useSelection: () => ReadonlySet<string>;
  clearSelection?: () => void;
  AddPanel: (props: { replaces: string | undefined }) => ReactNode;
  moveCard?: (card: GridCard, status: CardStatus) => void;
  moveCards?: (
    moves: readonly { card: GridCard; status: CardStatus }[],
    label: string,
    body?: string,
  ) => void;
  usePending: () => [readonly PendingMoveEntry[], (next: readonly PendingMoveEntry[]) => void];
  useFilters: () => Filter[] | undefined;
  putFilter?: (filter: Filter) => Promise<boolean>;
  deleteFilter?: (id: string) => void;
  useLayouts: () => Layout[] | undefined;
  putLayout?: (layout: Layout) => void;
  deleteLayout?: (id: string) => void;
}
