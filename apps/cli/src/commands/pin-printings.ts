import { readCards, writeCard } from "@repo/cube";
import { chalk } from "zx";
import { createClient } from "../client.ts";
import { CUBE_PATHS } from "../paths.ts";

export async function pinPrintings(dryRun: boolean): Promise<number> {
  const entries = await readCards(CUBE_PATHS);
  const loose = entries.filter((entry) => entry.printing === undefined);
  const { cards, missing } = await createClient().byOracleIds(loose.map((entry) => entry.oracleId));
  if (missing.length > 0) {
    console.error(chalk.red(`Scryfall could not find: ${missing.join(", ")}`));
    return 1;
  }
  const byOracle = new Map(cards.map((card) => [card.oracle_id, card]));
  for (const entry of loose) {
    const card = byOracle.get(entry.oracleId);
    if (card && !dryRun) {
      await writeCard(CUBE_PATHS, { ...entry, printing: card.id });
    }
  }
  const verb = dryRun ? "Would pin" : "Pinned";
  console.log(
    chalk.green(`${verb} ${String(loose.length)} cards to the printing they show now.`),
    chalk.dim(`${String(entries.length - loose.length)} already had a printing.`),
  );
  return 0;
}
