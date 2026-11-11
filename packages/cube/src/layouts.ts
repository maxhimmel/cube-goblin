import { z } from "zod";

export const layoutSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/u),
  label: z.string().trim().min(1),
  settings: z.record(z.string(), z.unknown()),
});

export const layoutsFileSchema = z
  .strictObject({ layouts: z.array(layoutSchema) })
  .refine(
    (file) => new Set(file.layouts.map((layout) => layout.id)).size === file.layouts.length,
    "layout ids must be unique",
  );

export type Layout = z.infer<typeof layoutSchema>;
export type LayoutsFile = z.infer<typeof layoutsFileSchema>;

export const EMPTY_LAYOUTS: LayoutsFile = { layouts: [] };

export function newLayoutId(
  existing: readonly Pick<Layout, "id">[],
  random: () => string = () => Math.random().toString(36).slice(2, 8),
): string {
  const ids = new Set(existing.map((layout) => layout.id));
  let id = `layout-${random()}`;
  while (ids.has(id)) {
    id = `layout-${random()}`;
  }
  return id;
}
