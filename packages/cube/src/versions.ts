import type { CubeDiff, CubeState } from "./diff.ts";
import { diffCube, statusCounts } from "./diff.ts";
import { parsePoint, stateAtEntry } from "./history.ts";
import { describeConflicts } from "./revert.ts";
import { readLogState } from "./save-log.ts";
import type { Version, VersionSummary } from "./schema.ts";
import { newVersionSchema } from "./schema.ts";
import { slugify } from "./slug.ts";
import type { CubePaths } from "./store.ts";
import { readBoard, readCards, readLog, readTags, readVersions, writeVersion } from "./store.ts";

export type VersionResult =
  { ok: true; version: VersionSummary } | { ok: false; status: 400 | 409; error: string };

export type CompareResult =
  { ok: true; diff: CubeDiff } | { ok: false; status: 404 | 409; error: string };

type PointState = { ok: true; state: CubeState } | { ok: false; status: 404 | 409; error: string };

export function localDate(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

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
  const id = `${localDate(now)}-${name}`;
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

async function pointState(paths: CubePaths, id: string): Promise<PointState> {
  const point = parsePoint(id);
  if (point.kind === "current") {
    return { ok: true, state: await readCubeState(paths) };
  }
  if (point.kind === "version") {
    const version = (await readVersions(paths)).find((item) => item.id === point.id);
    return version
      ? { ok: true, state: version }
      : { ok: false, status: 404, error: `No version "${id}"` };
  }
  const [state, log] = await Promise.all([readLogState(paths), readLog(paths)]);
  const plan = stateAtEntry(state, log, point.side, point.entry);
  if (!plan) {
    return { ok: false, status: 404, error: `No log entry "${point.entry}"` };
  }
  if (!plan.ok) {
    const reasons = [
      ...(plan.conflicts.length > 0 ? [describeConflicts(plan.conflicts)] : []),
      ...plan.problems,
    ];
    return {
      ok: false,
      status: 409,
      error: `The log can't rebuild the cube ${point.side} that entry: ${reasons.join("; ")}`,
    };
  }
  return { ok: true, state: plan.state };
}

export async function compareVersions(
  paths: CubePaths,
  from: string,
  to: string,
): Promise<CompareResult> {
  const [before, after] = await Promise.all([pointState(paths, from), pointState(paths, to)]);
  if (!before.ok) {
    return before;
  }
  if (!after.ok) {
    return after;
  }
  return { ok: true, diff: diffCube(before.state, after.state) };
}
