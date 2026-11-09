import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CardEntry } from "./schema.ts";
import { newCardSchema } from "./schema.ts";
import { slugify } from "./slug.ts";
import type { CubePaths } from "./store.ts";
import { WORKBENCH_BATCH, readCards, readSections, readTags, writeCard } from "./store.ts";
import { validateCube } from "./validate.ts";

export type AddResult =
  | { ok: true; card: CardEntry; replaced?: CardEntry }
  | { ok: false; status: 400 | 404; error: string };

export type NameLookup = (oracleId: string) => Promise<string | undefined>;

async function readBatch(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

export async function addCard(
  paths: CubePaths,
  input: unknown,
  lookup: NameLookup,
): Promise<AddResult> {
  const parsed = newCardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  const request = parsed.data;
  const [cards, sections, tags] = await Promise.all([
    readCards(paths),
    readSections(paths),
    readTags(paths),
  ]);
  const already = cards.find((card) => card.oracleId === request.oracleId);
  if (already) {
    return { ok: false, status: 400, error: `${already.name} is already in the cube` };
  }
  const name = await lookup(request.oracleId);
  if (name === undefined) {
    return { ok: false, status: 404, error: `No Scryfall card with oracle id ${request.oracleId}` };
  }
  const outgoing =
    request.replaces === undefined
      ? undefined
      : cards.find((card) => slugify(card.name) === request.replaces);
  if (request.replaces !== undefined && outgoing === undefined) {
    return { ok: false, status: 404, error: `No card "${request.replaces}"` };
  }
  if (outgoing?.status === "cut") {
    return { ok: false, status: 400, error: `${outgoing.name} is already cut` };
  }
  const replaced: CardEntry | undefined = outgoing && { ...outgoing, status: "cut" };

  const batch = await readBatch(paths.workbenchBatch);
  const prefix = batch.length > 0 && !batch.endsWith("\n") ? "\n" : "";
  const line = `${batch}${prefix}`.split("\n").length;
  const text = `[  ] ${name}`;
  const card: CardEntry = {
    name,
    oracleId: request.oracleId,
    status: request.status,
    ...(request.section === undefined ? {} : { section: request.section }),
    tags: request.copyTags === true && outgoing ? outgoing.tags : [],
    notes: "",
    source: { batch: WORKBENCH_BATCH, line, input: text },
  };

  const next = [
    ...cards.map((existing) => (replaced && existing === outgoing ? replaced : existing)),
    card,
  ];
  const problems = validateCube(next, sections, tags);
  if (problems.length > 0) {
    return { ok: false, status: 400, error: problems.join("\n") };
  }
  if (replaced) {
    await writeCard(paths, replaced);
  }
  await mkdir(dirname(paths.workbenchBatch), { recursive: true });
  await appendFile(paths.workbenchBatch, `${prefix}${text}\n`);
  await writeCard(paths, card);
  return replaced ? { ok: true, card, replaced } : { ok: true, card };
}
