import type { CubeConfig } from "./schema.ts";
import { cubeConfigSchema } from "./schema.ts";
import type { CubePaths } from "./store.ts";
import { writeConfig } from "./store.ts";

export type ConfigResult =
  { ok: true; config: CubeConfig } | { ok: false; status: 400; error: string };

export async function saveConfig(paths: CubePaths, input: unknown): Promise<ConfigResult> {
  const parsed = cubeConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.issues.map((issue) => issue.message).join("\n"),
    };
  }
  await writeConfig(paths, parsed.data);
  return { ok: true, config: parsed.data };
}
