import type { Section, SnapshotCard } from "@repo/cube/browser";
import type { ReactNode } from "react";

export interface CubeView {
  cards: SnapshotCard[];
  sections: Section[];
  label: string;
}

export interface Mode {
  name: "share" | "workbench";
  useCube: () => CubeView | undefined;
  useTileMark: (slug: string) => Record<string, string | undefined>;
  Toolbar: () => ReactNode;
  CardPanel: (props: { slug: string }) => ReactNode;
}
