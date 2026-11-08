import type { Tag } from "./schema.ts";
import { newTagSchema, tagChangeSchema } from "./schema.ts";
import type { CubePaths } from "./store.ts";
import { slugify } from "./slug.ts";
import { readTags, writeTags } from "./store.ts";

export function sameLabel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

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
  const existing = tags.find((tag) => tag.id === id || sameLabel(tag.label, parsed.data.label));
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
  const label = parsed.data.label ?? current.label;
  const clash = tags.find((other) => other.id !== id && sameLabel(other.label, label));
  if (clash) {
    return { ok: false, status: 409, error: `Tag "${clash.label}" already has that label` };
  }
  const tag: Tag = {
    id,
    label,
    kind: parsed.data.kind ?? current.kind,
  };
  await writeTags(
    paths,
    tags.map((other) => (other.id === id ? tag : other)),
  );
  return { ok: true, tag };
}
