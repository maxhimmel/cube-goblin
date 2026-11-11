import type { LayoutsFile } from "./layouts.ts";
import { layoutsFileSchema } from "./layouts.ts";
import type { CubePaths } from "./store.ts";
import { readLayouts, writeLayouts } from "./store.ts";

export type LayoutsResult =
  { ok: true; layouts: LayoutsFile } | { ok: false; status: 400; error: string };

export async function saveLayouts(paths: CubePaths, input: unknown): Promise<LayoutsResult> {
  const parsed = layoutsFileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  await writeLayouts(paths, parsed.data);
  return { ok: true, layouts: parsed.data };
}

export { readLayouts as loadLayouts };
