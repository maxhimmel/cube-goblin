import type { CubeDiff, CubeState } from "./diff.ts";
import { CURRENT, diffCube, statusCounts } from "./diff.ts";
import type { Version, VersionSummary } from "./schema.ts";
import { newVersionSchema } from "./schema.ts";
import { slugify } from "./slug.ts";
import type { CubePaths } from "./store.ts";
import { readBoard, readCards, readTags, readVersions, writeVersion } from "./store.ts";

export type VersionResult =
  { ok: true; version: VersionSummary } | { ok: false; status: 400 | 409; error: string };

export type CompareResult =
  { ok: true; diff: CubeDiff } | { ok: false; status: 404; error: string };

export function summarize(version: Version): VersionSummary {
  return {
    id: version.id,
    label: version.label,
    savedAt: version.savedAt,
    counts: statusCounts(version.cards),
  };
}

export async function readCubeState(paths: CubePaths): Promise<CubeState> {
  const [cards, tags, board] = await Promise.all([
    readCards(paths),
    readTags(paths),
    readBoard(paths),
  ]);
  return { cards, tags, board };
}

export async function listVersions(paths: CubePaths): Promise<VersionSummary[]> {
  return (await readVersions(paths)).map(summarize);
}

export async function saveVersion(
  paths: CubePaths,
  input: unknown,
  now: Date = new Date(),
): Promise<VersionResult> {
  const parsed = newVersionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  const name = slugify(parsed.data.label);
  if (name === "") {
    return { ok: false, status: 400, error: `"${parsed.data.label}" has no letters or digits` };
  }
  const id = `${now.toISOString().slice(0, 10)}-${name}`;
  const existing = await readVersions(paths);
  if (existing.some((version) => version.id === id)) {
    return { ok: false, status: 409, error: `A version "${id}" already exists` };
  }
  const state = await readCubeState(paths);
  const version: Version = {
    id,
    label: parsed.data.label,
    savedAt: now.toISOString(),
    cards: [...state.cards],
    tags: [...state.tags],
    board: state.board,
  };
  await writeVersion(paths, version);
  return { ok: true, version: summarize(version) };
}

export async function compareVersions(
  paths: CubePaths,
  from: string,
  to: string,
): Promise<CompareResult> {
  const versions = await readVersions(paths);
  const state = async (id: string): Promise<CubeState | undefined> =>
    id === CURRENT ? readCubeState(paths) : versions.find((version) => version.id === id);
  const [before, after] = await Promise.all([state(from), state(to)]);
  if (!before || !after) {
    return { ok: false, status: 404, error: `No version "${before ? to : from}"` };
  }
  return { ok: true, diff: diffCube(before, after) };
}
