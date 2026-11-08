import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Snapshot, SnapshotCard } from "@repo/cube";
import { readCards, readSections, slugify, snapshotSchema } from "@repo/cube";
import { cardFaces, imageUrl } from "@repo/scryfall";
import { chalk } from "zx";
import { createClient, USER_AGENT } from "../client.ts";
import { imageDataUri } from "../images.ts";
import { CUBE_PATHS, SNAPSHOT_FILE } from "../paths.ts";

export async function snapshot(): Promise<number> {
  const [entries, sections] = await Promise.all([readCards(CUBE_PATHS), readSections(CUBE_PATHS)]);
  const { cards, notFound } = await createClient().collection(
    entries.map((entry) => ({ oracle_id: entry.oracleId })),
  );
  if (notFound.length > 0) {
    console.error(chalk.red(`Scryfall could not find: ${JSON.stringify(notFound)}`));
    return 1;
  }
  const byOracle = new Map(cards.map((card) => [card.oracle_id, card]));

  const snapshotCards: SnapshotCard[] = [];
  for (const entry of entries) {
    const card = byOracle.get(entry.oracleId);
    const small = card ? imageUrl(card, "small") : undefined;
    const large = card ? imageUrl(card, "large") : undefined;
    if (!card || !small || !large) {
      console.error(chalk.red(`Missing Scryfall data or image for ${entry.name}`));
      return 1;
    }
    const faces = cardFaces(card);
    process.stderr.write(`\rImages ${String(snapshotCards.length + 1)}/${String(entries.length)}`);
    snapshotCards.push({
      slug: slugify(entry.name),
      name: entry.name,
      oracleId: entry.oracleId,
      status: entry.status,
      ...(entry.section === undefined ? {} : { section: entry.section }),
      manaCost: card.mana_cost ?? faces[0]?.mana_cost ?? "",
      typeLine: card.type_line ?? "",
      oracleText: faces.map((face) => face.oracle_text ?? "").join("\n//\n"),
      cmc: card.cmc ?? 0,
      colors: card.colors ?? card.color_identity,
      image: await imageDataUri(small, `${entry.oracleId}-small`, USER_AGENT),
      imageLarge: large,
      scryfallUri: card.scryfall_uri.split("?")[0] ?? card.scryfall_uri,
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
    sections,
  });
  await mkdir(dirname(SNAPSHOT_FILE), { recursive: true });
  await writeFile(SNAPSHOT_FILE, JSON.stringify(result));
  console.log(
    chalk.green(`Snapshot ${id}: ${String(snapshotCards.length)} cards -> ${SNAPSHOT_FILE}`),
  );
  return 0;
}
