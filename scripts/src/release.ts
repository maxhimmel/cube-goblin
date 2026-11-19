import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $, argv, cd, chalk } from "zx";
import { nextVersion } from "./release-version.ts";
import { REPO_ROOT } from "./repo.ts";

const MANIFEST = join(REPO_ROOT, "apps/desktop/package.json");

const request = argv._[0] ?? "";
if (request === "") {
  console.error(chalk.red("Usage: pnpm release <patch|minor|major|X.Y.Z>"));
  process.exit(1);
}

cd(REPO_ROOT);
$.verbose = true;

const git = async (...args: string[]): Promise<string> =>
  (await $({ quiet: true })`git ${args}`).stdout.trim();

if ((await git("branch", "--show-current")) !== "main") {
  throw new Error("Release from main.");
}
if ((await git("status", "--porcelain")) !== "") {
  throw new Error("Working tree is not clean.");
}
await $`git fetch origin main`;
if ((await git("rev-list", "--count", "main..origin/main")) !== "0") {
  throw new Error("origin/main has commits main lacks. Pull first.");
}

const manifest = JSON.parse(await readFile(MANIFEST, "utf8")) as { version: string };
const version = nextVersion(manifest.version, request);
const tag = `v${version}`;
const branch = `chore/release-${version.replaceAll(".", "-")}`;

await $`git switch -c ${branch}`;
const text = await readFile(MANIFEST, "utf8");
await writeFile(
  MANIFEST,
  text.replace(`"version": "${manifest.version}"`, `"version": "${version}"`),
);
await $`git add ${MANIFEST}`;
await $`git commit -m ${`chore(release): ${tag}`}`;
await $`git switch main`;
try {
  await $`git merge --no-ff ${branch} -m ${`Merge branch '${branch}'`}`;
} catch (error) {
  await $`git merge --abort`.nothrow();
  await $`git branch -D ${branch}`;
  console.error(chalk.red("The merge failed (pnpm check?). Main is unchanged; fix it and re-run."));
  throw error;
}
await $`git tag -a ${tag} -m ${`Cube Goblin ${version}`}`;
await $`git push --atomic origin main ${tag}`;
console.log(chalk.green(`Pushed ${tag}. The release workflow builds and publishes it.`));
