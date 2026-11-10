import {
  FUNCTION_ORACLE_TAG_IDS,
  functionTags,
  readCards,
  readTags,
  withFunctionTags,
  writeCard,
  writeTags,
} from "@repo/cube";
import { chalk } from "zx";
import { createClient, createOracleTagStore } from "../client.ts";
import { CUBE_PATHS } from "../paths.ts";

export async function tagFunctions(dryRun: boolean): Promise<number> {
  const [entries, vocabulary] = await Promise.all([readCards(CUBE_PATHS), readTags(CUBE_PATHS)]);
  const client = createClient();
  const [{ cards, missing }, oracleTags] = await Promise.all([
    client.byOracleIds(entries.map((entry) => entry.oracleId)),
    createOracleTagStore(client).load(FUNCTION_ORACLE_TAG_IDS),
  ]);
  if (oracleTags.error !== undefined) {
    console.error(chalk.red(`Oracle tags unavailable: ${oracleTags.error}`));
    return 1;
  }
  if (missing.length > 0) {
    console.error(chalk.red(`Scryfall could not find: ${missing.join(", ")}`));
    return 1;
  }
  const byOracle = new Map(cards.map((card) => [card.oracle_id, card]));
  const nextVocabulary = withFunctionTags(vocabulary);
  const added = nextVocabulary.length - vocabulary.length;
  let changed = 0;
  let tagged = 0;
  for (const entry of entries) {
    const found = functionTags(
      { oracleId: entry.oracleId, producedMana: byOracle.get(entry.oracleId)?.produced_mana ?? [] },
      oracleTags.index,
    );
    const tags = [...new Set([...entry.tags, ...found])];
    tagged += tags.length - entry.tags.length;
    if (tags.length !== entry.tags.length) {
      changed += 1;
      if (!dryRun) {
        await writeCard(CUBE_PATHS, { ...entry, tags });
      }
    }
  }
  if (!dryRun && added > 0) {
    await writeTags(CUBE_PATHS, nextVocabulary);
  }
  const verb = dryRun ? "Would add" : "Added";
  console.log(
    chalk.green(
      `${verb} ${String(added)} function tags to tags.json and ${String(tagged)} tags to ${String(changed)} cards.`,
    ),
  );
  return 0;
}
