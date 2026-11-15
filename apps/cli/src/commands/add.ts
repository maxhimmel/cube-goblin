import type { CubePaths } from "@repo/cube";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { CardEntry } from "@repo/cube";
import { parseBatch, readCards, writeCard } from "@repo/cube";
import { chalk } from "zx";
import { createClient } from "../client.ts";
import { normalizeName, resolveEntries } from "../resolve.ts";

export interface AddOptions {
  dryRun: boolean;
}

export async function addBatch(
  paths: CubePaths,
  file: string,
  options: AddOptions,
): Promise<number> {
  const batch = basename(file, extname(file));
  const lines = parseBatch(await readFile(file, "utf8"));
  const existing = new Map((await readCards(paths)).map((card) => [card.oracleId, card]));
  const { resolved, unresolved } = await resolveEntries(createClient(), lines, (done, total) => {
    process.stderr.write(`\rResolving ${String(done)}/${String(total)}`);
  });
  process.stderr.write("\n");

  const written: CardEntry[] = [];
  const skipped: string[] = [];
  for (const { entry, card, how } of resolved) {
    const oracleId = card.oracle_id;
    if (oracleId === undefined) {
      unresolved.push({ entry, reason: `"${card.name}" has no oracle_id` });
      continue;
    }
    const already = existing.get(oracleId);
    if (already) {
      skipped.push(
        `${entry.name} -> ${card.name} (already in cube from ${already.source.batch}:${String(already.source.line)})`,
      );
      continue;
    }
    const cardEntry: CardEntry = {
      name: card.name,
      oracleId,
      status: "draft",
      tags: [],
      notes: "",
      source: { batch, line: entry.line, input: entry.input },
    };
    existing.set(oracleId, cardEntry);
    written.push(cardEntry);
    if (!options.dryRun) {
      await writeCard(paths, cardEntry);
    }
    if (how === "fuzzy" && normalizeName(entry.name) !== normalizeName(card.name)) {
      console.log(`${chalk.yellow("~")} ${entry.name} ${chalk.dim("->")} ${chalk.bold(card.name)}`);
    }
  }

  console.log(
    chalk.green(`${options.dryRun ? "Would add" : "Added"} ${String(written.length)} draft cards`),
  );
  for (const line of skipped) {
    console.log(chalk.dim(`skip: ${line}`));
  }
  for (const { entry, reason } of unresolved) {
    console.log(chalk.red(`unresolved line ${String(entry.line)}: "${entry.name}": ${reason}`));
  }
  return unresolved.length > 0 ? 1 : 0;
}
