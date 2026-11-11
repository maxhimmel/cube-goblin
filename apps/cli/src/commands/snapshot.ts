import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Snapshot, SnapshotCard } from "@repo/cube";
import { loadFilters, readCards, readTags, slugify, snapshotSchema } from "@repo/cube";
import { displayFields } from "@repo/scryfall";
import { chalk } from "zx";
import { createClient, USER_AGENT } from "../client.ts";
import { imageDataUri } from "../images.ts";
import { CUBE_PATHS, SNAPSHOT_FILE } from "../paths.ts";

export async function snapshot(): Promise<number> {
  const [entries, vocabulary, saved] = await Promise.all([
    readCards(CUBE_PATHS),
    readTags(CUBE_PATHS),
    loadFilters(CUBE_PATHS),
  ]);
  const client = createClient();
  const { cards: byOracle, missing: notFound, unresolved } = await client.forEntries(entries);
  if (unresolved.length > 0) {
    const names = entries
      .filter((entry) => unresolved.includes(entry.oracleId))
      .map((entry) => entry.name);
    console.error(chalk.red(`Chosen printing not found for: ${names.join(", ")}`));
    return 1;
  }
  if (notFound.length > 0) {
    console.error(chalk.red(`Scryfall could not find: ${JSON.stringify(notFound)}`));
    return 1;
  }

  const snapshotCards: SnapshotCard[] = [];
  for (const entry of entries) {
    const card = byOracle.get(entry.oracleId);
    const fields = card ? displayFields(card) : undefined;
    if (!card || !fields) {
      console.error(chalk.red(`Missing Scryfall data or image for ${entry.name}`));
      return 1;
    }
    process.stderr.write(`\rImages ${String(snapshotCards.length + 1)}/${String(entries.length)}`);
    snapshotCards.push({
      slug: slugify(entry.name),
      name: entry.name,
      oracleId: entry.oracleId,
      status: entry.status,
      ...fields,
      tags: entry.tags,
      image: await imageDataUri(fields.image, `${card.id}-small`, USER_AGENT),
    });
  }
  process.stderr.write("\n");

  const id = createHash("sha256")
    .update(JSON.stringify(snapshotCards.map((card) => ({ ...card, image: "" }))))
    .digest("hex")
    .slice(0, 12);
  const result: Snapshot = snapshotSchema.parse({
    id,
    createdAt: new Date().toISOString(),
    cards: snapshotCards,
    vocabulary,
    filters: saved.filters,
  });
  await mkdir(dirname(SNAPSHOT_FILE), { recursive: true });
  await writeFile(SNAPSHOT_FILE, JSON.stringify(result));
  console.log(
    chalk.green(`Snapshot ${id}: ${String(snapshotCards.length)} cards -> ${SNAPSHOT_FILE}`),
  );
  return 0;
}
