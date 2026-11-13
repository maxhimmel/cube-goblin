import { useEffect, useState } from "react";
import { z } from "zod";

export const REMEMBERED = {
  "/insights": [["scope"]],
  "/tags": [["mode"], ["tags"], ["sort"]],
} as const satisfies Record<string, readonly (readonly string[])[]>;

const FORGOTTEN: Partial<Record<RememberedPath, Record<string, readonly string[]>>> = {
  "/insights": { scope: ["selected"] },
};

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

function pick(keys: readonly string[], search: Record<string, unknown>): Choices {
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = search[key];
      return typeof value === "string" && value !== "" ? [[key, value]] : [];
    }),
  );
}

export function pickChoices(path: RememberedPath, search: Record<string, unknown>): Choices {
  const forgotten = FORGOTTEN[path] ?? {};
  return Object.fromEntries(
    Object.entries(pick(REMEMBERED[path].flat(), search)).filter(
      ([key, value]) => !(forgotten[key] ?? []).includes(value),
    ),
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
  const saved = pickChoices(path, read(store, SEARCH_KEY, storedSchema)?.[path] ?? {});
  const missing = REMEMBERED[path].filter((group) => Object.keys(pick(group, search)).length === 0);
  const restored = pick(missing.flat(), saved);
  return Object.keys(restored).length > 0 ? restored : undefined;
}

export function recallState<T>(
  key: string,
  schema: z.ZodType<T>,
  store: KeyValueStore | undefined = browserStore(),
): T | undefined {
  const parsed = schema.safeParse(read(store, STATE_KEY, stateSchema)?.[key]);
  return parsed.success ? parsed.data : undefined;
}

const stateListeners = new Map<string, Set<(value: unknown) => void>>();

export function rememberState(
  key: string,
  value: unknown,
  store: KeyValueStore | undefined = browserStore(),
): void {
  const all = read(store, STATE_KEY, stateSchema) ?? {};
  write(store, STATE_KEY, { ...all, [key]: value });
  for (const listener of stateListeners.get(key) ?? []) {
    listener(value);
  }
}

export function useRemembered<T>(
  key: string,
  fallback: T,
  schema: z.ZodType<T>,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => recallState(key, schema) ?? fallback);
  useEffect(() => {
    const listener = (next: unknown): void => {
      const parsed = schema.safeParse(next);
      if (parsed.success) {
        setValue(parsed.data);
      }
    };
    const listeners = stateListeners.get(key) ?? new Set();
    listeners.add(listener);
    stateListeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
    };
  }, [key, schema]);
  return [
    value,
    (next: T) => {
      rememberState(key, next);
      setValue(next);
    },
  ];
}

export function recallStates(
  match: (key: string) => boolean,
  store: KeyValueStore | undefined = browserStore(),
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(read(store, STATE_KEY, stateSchema) ?? {}).filter(([key]) => match(key)),
  );
}

export function replaceStates(
  match: (key: string) => boolean,
  values: Record<string, unknown>,
  store: KeyValueStore | undefined = browserStore(),
): void {
  const kept = Object.entries(read(store, STATE_KEY, stateSchema) ?? {}).filter(
    ([key]) => !match(key),
  );
  const added = Object.entries(values).filter(([key]) => match(key));
  write(store, STATE_KEY, Object.fromEntries([...kept, ...added]));
}
