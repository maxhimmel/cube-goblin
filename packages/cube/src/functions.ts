export const CARD_FUNCTIONS = [
  { id: "removal", label: "Removal", oracleTagId: "444f824c-f910-4530-9dbe-ede7a84cd7f9" },
  { id: "sweeper", label: "Board wipe", oracleTagId: "3fb7e4fd-5304-4120-b7c4-8a89f70ad3f0" },
  {
    id: "counterspell",
    label: "Counterspell",
    oracleTagId: "690fc968-48ba-4854-a948-3db6bf19d3a9",
  },
  { id: "ramp", label: "Ramp", oracleTagId: "2f3e4ad7-5e60-41b4-bdbc-653f16869cf6" },
  { id: "draw", label: "Draw", oracleTagId: "b6448c45-ce65-4848-aa98-2151e4e07437" },
  { id: "fixing", label: "Fixing", oracleTagId: "b6f0c0ee-2bb3-48a1-8430-d3304121d95e" },
] as const;

export type CardFunction = (typeof CARD_FUNCTIONS)[number]["id"];

export const CARD_FUNCTION_IDS = CARD_FUNCTIONS.map((entry) => entry.id) as [
  CardFunction,
  ...CardFunction[],
];

export const FUNCTION_ORACLE_TAG_IDS: readonly string[] = CARD_FUNCTIONS.map(
  (entry) => entry.oracleTagId,
);

const FIXING_COLORS = new Set(["W", "U", "B", "R", "G"]);

export function producesFixing(producedMana: readonly string[]): boolean {
  return producedMana.filter((symbol) => FIXING_COLORS.has(symbol)).length >= 2;
}

export function cardFunctions(
  card: { oracleId: string; producedMana: readonly string[] },
  index: Readonly<Record<string, readonly string[]>>,
): CardFunction[] {
  return CARD_FUNCTIONS.filter(
    (entry) =>
      (index[entry.oracleTagId]?.includes(card.oracleId) ?? false) ||
      (entry.id === "fixing" && producesFixing(card.producedMana)),
  ).map((entry) => entry.id);
}
