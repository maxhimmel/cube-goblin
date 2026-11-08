import type { Tag } from "./schema.ts";
import { newTagSchema, tagChangeSchema } from "./schema.ts";
import type { CubePaths } from "./store.ts";
import { readTags, slugify, writeTags } from "./store.ts";

export type TagResult =
  { ok: true; tag: Tag } | { ok: false; status: 400 | 404 | 409; error: string };

export async function createTag(paths: CubePaths, input: unknown): Promise<TagResult> {
  const parsed = newTagSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  const id = slugify(parsed.data.label);
  if (id === "") {
    return { ok: false, status: 400, error: `"${parsed.data.label}" has no letters or digits` };
  }
  const tags = await readTags(paths);
  const existing = tags.find((tag) => tag.id === id);
  if (existing) {
    return { ok: false, status: 409, error: `Tag "${existing.label}" already exists` };
  }
  const tag: Tag = { id, ...parsed.data };
  await writeTags(paths, [...tags, tag]);
  return { ok: true, tag };
}

export async function changeTag(paths: CubePaths, id: string, input: unknown): Promise<TagResult> {
  const parsed = tagChangeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.message };
  }
  const tags = await readTags(paths);
  const current = tags.find((tag) => tag.id === id);
  if (!current) {
    return { ok: false, status: 404, error: `No tag "${id}"` };
  }
  const tag: Tag = {
    id,
    label: parsed.data.label ?? current.label,
    kind: parsed.data.kind ?? current.kind,
  };
  await writeTags(
    paths,
    tags.map((other) => (other.id === id ? tag : other)),
  );
  return { ok: true, tag };
}
