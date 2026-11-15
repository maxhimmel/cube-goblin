import { parseArgs } from "node:util";

export function cubeArgs(): string[] {
  const { values } = parseArgs({
    options: { cube: { type: "string" } },
    allowPositionals: true,
    strict: false,
  });
  return typeof values.cube === "string" ? ["--cube", values.cube] : [];
}
