import type { Section, SnapshotCard, Tag } from "@repo/cube/browser";
import type { ReactNode } from "react";

export type GridCard = SnapshotCard & { tags?: string[] };

export interface CubeView {
  cards: GridCard[];
  sections: Section[];
  vocabulary: Tag[];
  label: string;
}

export interface Mode {
  name: "share" | "workbench";
  useCube: () => CubeView | undefined;
  useTileMark: (slug: string) => Record<string, string | undefined>;
  Toolbar: () => ReactNode;
  CardPanel: (props: { slug: string }) => ReactNode;
  TagsPage: () => ReactNode;
  SelectCard: (props: { slug: string; name: string }) => ReactNode;
  SelectPile: (props: { slugs: string[]; label: string }) => ReactNode;
  BulkBar: () => ReactNode;
  Stats: () => ReactNode;
  AddPage: (props: { replaces: string | undefined }) => ReactNode;
}
