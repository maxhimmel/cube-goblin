import { mode } from "#mode";
import type { CompareScope, CompareUnit, Tag, TagCount } from "@repo/cube/browser";
import {
  COMPARE_SCOPES,
  COMPARE_UNITS,
  inCompareScope,
  matchTags,
  translateTags,
  unmatchedTagCounts,
} from "@repo/cube/browser";
import type { CubeRef } from "@repo/server/events";
import { useMemo } from "react";
import { z } from "zod";
import type { CubeView, GridCard } from "../modes/mode.ts";
import { useRemembered } from "../view-choices.ts";

export interface CompareChoice {
  dir: string | null;
  scope: CompareScope;
  unit: CompareUnit;
}

const NO_CHOICE: CompareChoice = { dir: null, scope: "draft", unit: "share" };

const choiceSchema: z.ZodType<CompareChoice> = z.object({
  dir: z.string().nullable().catch(null),
  scope: z.enum(COMPARE_SCOPES).catch("draft"),
  unit: z.enum(COMPARE_UNITS).catch("share"),
});

export interface Against {
  name: string;
  cards: GridCard[];
  unit: CompareUnit;
  unmatched: TagCount[];
}

export type CompareStatus =
  | { kind: "off" }
  | { kind: "loading"; name: string }
  | { kind: "failed"; name: string; error: string }
  | { kind: "ready"; name: string };

export interface Compare {
  cubes: CubeRef[] | undefined;
  choice: CompareChoice;
  setChoice: (next: CompareChoice) => void;
  against: Against | undefined;
  status: CompareStatus;
}

function against(
  name: string,
  cube: CubeView,
  vocabulary: readonly Tag[],
  choice: CompareChoice,
): Against {
  const match = matchTags(vocabulary, cube.vocabulary);
  const cards = translateTags(
    cube.cards.filter((card) => inCompareScope(card, choice.scope)),
    match,
  );
  return { name, cards, unit: choice.unit, unmatched: unmatchedTagCounts(cards, match) };
}

export function useCompare(vocabulary: readonly Tag[]): Compare {
  const [choice, setChoice] = useRemembered("forge.compare", NO_CHOICE, choiceSchema);
  const cubes = mode.useOtherCubes?.();
  const picked = cubes?.find((cube) => cube.dir === choice.dir);
  const other = mode.useOtherCube?.(picked?.dir);
  const cube = other?.status === "ready" ? other.cube : undefined;
  const name = picked?.name;
  const built = useMemo(
    () => (name !== undefined && cube ? against(name, cube, vocabulary, choice) : undefined),
    [name, cube, vocabulary, choice],
  );
  const status: CompareStatus =
    picked === undefined || other === undefined
      ? { kind: "off" }
      : other.status === "ready"
        ? { kind: "ready", name: picked.name }
        : other.status === "failed"
          ? { kind: "failed", name: picked.name, error: other.error }
          : { kind: "loading", name: picked.name };
  return { cubes, choice, setChoice, against: built, status };
}
