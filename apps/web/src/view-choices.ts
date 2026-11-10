import { useState } from "react";
import { z } from "zod";

export const REMEMBERED = {
  "/": ["by", "with", "without"],
  "/cards": ["by"],
  "/insights": ["scope"],
  "/tags": ["tags"],
  "/board": ["sort"],
} as const satisfies Record<string, readonly string[]>;

export type RememberedPath = keyof typeof REMEMBERED;

const SEARCH_KEY = "maxs-cube:view-search:v1";
const STATE_KEY = "maxs-cube:view-state:v1";

type Choices = Record<string, string>;

const storedSchema = z.record(z.string(), z.record(z.string(), z.string()));
const stateSchema = z.record(z.string(), z.unknown());

interface KeyValueStore {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function browserStore(): KeyValueStore | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function read<T>(
  store: KeyValueStore | undefined,
  key: string,
  schema: z.ZodType<T>,
): T | undefined {
  try {
    const parsed = schema.safeParse(JSON.parse(store?.getItem(key) ?? "null"));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function write(store: KeyValueStore | undefined, key: string, value: unknown): void {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export function isRemembered(path: string): path is RememberedPath {
  return Object.hasOwn(REMEMBERED, path);
}

export function pickChoices(path: RememberedPath, search: Record<string, unknown>): Choices {
  const keys: readonly string[] = REMEMBERED[path];
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = search[key];
      return typeof value === "string" && value !== "" ? [[key, value]] : [];
    }),
  );
}

export function rememberSearch(
  path: RememberedPath,
  search: Record<string, unknown>,
  store: KeyValueStore | undefined = browserStore(),
): void {
  const all = read(store, SEARCH_KEY, storedSchema) ?? {};
  write(store, SEARCH_KEY, { ...all, [path]: pickChoices(path, search) });
}

export function recallSearch(
  path: RememberedPath,
  search: Record<string, unknown>,
  store: KeyValueStore | undefined = browserStore(),
): Choices | undefined {
  if (Object.keys(pickChoices(path, search)).length > 0) {
    return undefined;
  }
  const saved = pickChoices(path, read(store, SEARCH_KEY, storedSchema)?.[path] ?? {});
  return Object.keys(saved).length > 0 ? saved : undefined;
}

export function recallState<T>(
  key: string,
  schema: z.ZodType<T>,
  store: KeyValueStore | undefined = browserStore(),
): T | undefined {
  const parsed = schema.safeParse(read(store, STATE_KEY, stateSchema)?.[key]);
  return parsed.success ? parsed.data : undefined;
}

export function rememberState(
  key: string,
  value: unknown,
  store: KeyValueStore | undefined = browserStore(),
): void {
  const all = read(store, STATE_KEY, stateSchema) ?? {};
  write(store, STATE_KEY, { ...all, [key]: value });
}

export function useRemembered<T>(
  key: string,
  fallback: T,
  schema: z.ZodType<T>,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => recallState(key, schema) ?? fallback);
  return [
    value,
    (next: T) => {
      setValue(next);
      rememberState(key, next);
    },
  ];
}
