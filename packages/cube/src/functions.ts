import type { Tag } from "./schema.ts";

export const CARD_FUNCTIONS = [
  { id: "removal", label: "removal", oracleTagId: "444f824c-f910-4530-9dbe-ede7a84cd7f9" },
  { id: "board-wipe", label: "board wipe", oracleTagId: "3fb7e4fd-5304-4120-b7c4-8a89f70ad3f0" },
  { id: "burn", label: "burn", oracleTagId: "0641a74c-4dd5-426d-be58-2ab86d71995d" },
  { id: "bounce", label: "bounce", oracleTagId: "de1ee67d-74ab-4ffc-8d65-1e5c0d233464" },
  {
    id: "counterspell",
    label: "counterspell",
    oracleTagId: "690fc968-48ba-4854-a948-3db6bf19d3a9",
  },
  { id: "discard", label: "discard", oracleTagId: "fce2f2c1-bb65-45e8-8c0a-dd66093067d7" },
  { id: "ramp", label: "ramp", oracleTagId: "2f3e4ad7-5e60-41b4-bdbc-653f16869cf6" },
  { id: "fixing", label: "fixing", oracleTagId: "b6f0c0ee-2bb3-48a1-8430-d3304121d95e" },
  { id: "card-draw", label: "card draw", oracleTagId: "b6448c45-ce65-4848-aa98-2151e4e07437" },
  { id: "looting", label: "looting", oracleTagId: "1c2215a5-d782-4f1b-a223-2bbd26c1f532" },
  { id: "tutor", label: "tutor", oracleTagId: "c768d2ec-3264-4a90-a98f-bea8467857d3" },
  { id: "recursion", label: "recursion", oracleTagId: "82b824ad-648f-467f-a190-2e0fa9a795d2" },
  { id: "reanimate", label: "reanimate", oracleTagId: "524d7da0-9b4b-4567-bf38-a867673e21f3" },
  {
    id: "token-maker",
    label: "token maker",
    oracleTagId: "a9657a5d-e7f8-4000-a795-7a78b5fb8923",
  },
  { id: "lifegain", label: "lifegain", oracleTagId: "4caab3cc-1d60-44fb-a26a-cc833bc67c97" },
  {
    id: "sac-outlet",
    label: "sac outlet",
    oracleTagId: "c7bd55a7-1ea0-49da-b25e-0be470fbe8ec",
  },
  { id: "mill", label: "mill", oracleTagId: "82b4e653-20f8-44a9-ab46-621f7c49b135" },
  { id: "evasion", label: "evasion", oracleTagId: "c7756471-d290-452f-bfc6-24866c841f28" },
  {
    id: "combat-trick",
    label: "combat trick",
    oracleTagId: "36f2a0d4-b689-4011-9750-472dd786f2de",
  },
  {
    id: "protection",
    label: "protection",
    oracleTagId: "6e2cdc7c-b02c-4b59-a171-f93723721b79",
  },
] as const;

export const FUNCTION_ORACLE_TAG_IDS: readonly string[] = CARD_FUNCTIONS.map(
  (entry) => entry.oracleTagId,
);

export const FUNCTION_TAGS: readonly Tag[] = CARD_FUNCTIONS.map(({ id, label }) => ({
  id,
  label,
  kind: "group",
}));

const FIXING_COLORS = new Set(["W", "U", "B", "R", "G"]);

export function producesFixing(producedMana: readonly string[]): boolean {
  return producedMana.filter((symbol) => FIXING_COLORS.has(symbol)).length >= 2;
}

export function functionTags(
  card: { oracleId: string; producedMana: readonly string[] },
  index: Readonly<Record<string, readonly string[]>>,
): string[] {
  return CARD_FUNCTIONS.filter(
    (entry) =>
      (index[entry.oracleTagId]?.includes(card.oracleId) ?? false) ||
      (entry.id === "fixing" && producesFixing(card.producedMana)),
  ).map((entry) => entry.id);
}

export function withFunctionTags(vocabulary: readonly Tag[]): Tag[] {
  const known = new Set(vocabulary.map((tag) => tag.id));
  return [...vocabulary, ...FUNCTION_TAGS.filter((tag) => !known.has(tag.id))];
}
