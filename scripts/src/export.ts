import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { $, cd, chalk } from "zx";
import { slugify } from "@repo/cube/browser";
import { cubeArgs } from "./cube-option.ts";
import { REPO_ROOT } from "./repo.ts";

const cube = cubeArgs();
cd(REPO_ROOT);
await $`pnpm -s cube snapshot ${cube}`;
await $`pnpm -s cube share-version ${cube}`;
await $`pnpm exec turbo run build --filter=@repo/web`;

const snapshot = JSON.parse(
  await readFile(join(REPO_ROOT, "apps/web/src/generated/snapshot.json"), "utf8"),
) as { id: string; name: string };
const outDir = join(REPO_ROOT, "exports");
const outFile = join(outDir, `${slugify(snapshot.name) || "cube"}-${snapshot.id}.html`);
await mkdir(outDir, { recursive: true });
await copyFile(join(REPO_ROOT, "apps/web/dist/index.html"), outFile);
const { size } = await stat(outFile);
console.log(chalk.green(`Share doc: ${outFile} (${(size / 1024 / 1024).toFixed(2)} MB)`));
