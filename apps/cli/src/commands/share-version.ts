import { readFile } from "node:fs/promises";
import { listVersions, saveVersion, snapshotSchema } from "@repo/cube";
import { chalk } from "zx";
import { CUBE_PATHS, SNAPSHOT_FILE } from "../paths.ts";

function sharedVersionLabel(snapshotId: string): string {
  return `shared-${snapshotId}`;
}

export async function shareVersion(): Promise<number> {
  const snapshot = snapshotSchema.parse(JSON.parse(await readFile(SNAPSHOT_FILE, "utf8")));
  const label = sharedVersionLabel(snapshot.id);
  const existing = (await listVersions(CUBE_PATHS)).find((version) => version.label === label);
  if (existing) {
    console.log(chalk.dim(`Version ${existing.id} already holds snapshot ${snapshot.id}`));
    return 0;
  }
  const result = await saveVersion(CUBE_PATHS, { label });
  if (!result.ok) {
    console.error(chalk.red(result.error));
    return 1;
  }
  console.log(chalk.green(`Saved version ${result.version.id} for snapshot ${snapshot.id}`));
  return 0;
}
