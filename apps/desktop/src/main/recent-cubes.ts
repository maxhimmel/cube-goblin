import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CubeRef } from "@repo/server";

export interface Recent {
  cubes: CubeRef[];
}

function isCubeRef(value: unknown): value is CubeRef {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { dir, id, name } = value as Record<string, unknown>;
  return typeof dir === "string" && typeof id === "string" && typeof name === "string";
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return undefined;
  }
}

async function legacyRepoRoot(userData: string): Promise<string | undefined> {
  const settings = await readJson(join(userData, "settings.json"));
  if (typeof settings === "object" && settings !== null && "repoRoot" in settings) {
    const { repoRoot } = settings;
    return typeof repoRoot === "string" ? repoRoot : undefined;
  }
  return undefined;
}

export class RecentCubes {
  readonly #file: string;
  readonly #userData: string;

  constructor(userData: string) {
    this.#userData = userData;
    this.#file = join(userData, "cubes.json");
  }

  async load(): Promise<Recent> {
    const raw = await readJson(this.#file);
    const cubes =
      typeof raw === "object" && raw !== null && "cubes" in raw && Array.isArray(raw.cubes)
        ? raw.cubes.filter(isCubeRef)
        : [];
    return { cubes };
  }

  async legacyFolder(): Promise<string | undefined> {
    return legacyRepoRoot(this.#userData);
  }

  async #save(recent: Recent): Promise<Recent> {
    await mkdir(dirname(this.#file), { recursive: true });
    const temp = `${this.#file}.tmp`;
    await writeFile(temp, `${JSON.stringify(recent, null, 2)}\n`);
    await rename(temp, this.#file);
    return recent;
  }

  async opened(cube: CubeRef): Promise<Recent> {
    const { cubes } = await this.load();
    return this.#save({
      cubes: [cube, ...cubes.filter((known) => known.dir !== cube.dir)],
    });
  }

  async remove(dir: string): Promise<Recent> {
    const { cubes } = await this.load();
    return this.#save({ cubes: cubes.filter((known) => known.dir !== dir) });
  }
}
