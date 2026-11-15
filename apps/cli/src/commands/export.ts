import { writeFile } from "node:fs/promises";
import type { CubePaths } from "@repo/cube";
import {
  EXPORT_FORMATS,
  exportFormat,
  formatLosses,
  readCards,
  readConfig,
  readTags,
  toExportCards,
} from "@repo/cube";
import { chalk } from "zx";
import { createClient } from "../client.ts";

export async function exportCube(
  paths: CubePaths,
  formatId: string | undefined,
  out: string | undefined,
): Promise<number> {
  const format = formatId === undefined ? undefined : exportFormat(formatId);
  if (format === undefined) {
    console.error(
      `export: --format must be one of ${EXPORT_FORMATS.map((entry) => entry.id).join(", ")}`,
    );
    return 1;
  }
  const [cards, tags, config] = await Promise.all([
    readCards(paths),
    readTags(paths),
    readConfig(paths),
  ]);
  const { cards: printings } = await createClient().forEntries(cards);
  const text = format.write(
    toExportCards(cards, tags, (entry) => printings.get(entry.oracleId)),
    { name: config.name, size: config.size },
  );
  const losses = formatLosses(format);
  if (losses.length > 0) {
    console.error(chalk.yellow(`${format.label} can't carry ${losses.join(", ")}`));
  }
  if (out === undefined) {
    process.stdout.write(text);
  } else {
    await writeFile(out, text);
    console.error(chalk.green(`Wrote ${out}`));
  }
  return 0;
}
