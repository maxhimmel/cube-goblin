import type { FiltersFile } from "./filters.ts";
import { filtersFileSchema, pruneFilters, validateFilters } from "./filters.ts";
import type { CubePaths } from "./store.ts";
import { readFilters, readTags, writeFilters } from "./store.ts";

export type FiltersResult =
  { ok: true; filters: FiltersFile } | { ok: false; status: 400; error: string };

export async function saveFilters(paths: CubePaths, input: unknown): Promise<FiltersResult> {
  const parsed = filtersFileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  const tags = await readTags(paths);
  const file = pruneFilters(parsed.data, tags);
  const problems = validateFilters(file, tags);
  if (problems.length > 0) {
    return { ok: false, status: 400, error: problems.join("\n") };
  }
  await writeFilters(paths, file);
  return { ok: true, filters: file };
}

export async function loadFilters(paths: CubePaths): Promise<FiltersFile> {
  const [file, tags] = await Promise.all([readFilters(paths), readTags(paths)]);
  return pruneFilters(file, tags);
}
