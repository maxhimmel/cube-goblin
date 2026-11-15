import { writeFile } from "node:fs/promises";
import type { CubePaths } from "@repo/cube";
import { EXPORT_FORMATS } from "@repo/cube";
import { exportCube as exportText } from "@repo/server";
import { chalk } from "zx";
import { createClient } from "../client.ts";

export async function exportCube(
  paths: CubePaths,
  formatId: string | undefined,
  out: string | undefined,
): Promise<number> {
  const result = await exportText(paths, createClient(), formatId ?? "");
  if (!result.ok) {
    console.error(
      `export: --format must be one of ${EXPORT_FORMATS.map((entry) => entry.id).join(", ")}`,
    );
    return 1;
  }
  if (result.losses.length > 0) {
    console.error(chalk.yellow(`This format can't carry ${result.losses.join(", ")}`));
  }
  if (out === undefined) {
    process.stdout.write(result.text);
  } else {
    await writeFile(out, result.text);
    console.error(chalk.green(`Wrote ${out}`));
  }
  return 0;
}
