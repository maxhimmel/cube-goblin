import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_NAMES, scopeStorage, storageKey } from "./storage-scope.ts";

function memory(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

afterEach(() => {
  scopeStorage("", "", memory());
});

describe("storage scope", () => {
  it("keeps each cube's choices under its own id", () => {
    scopeStorage("cube-a", "", memory());
    const a = storageKey(STORAGE_NAMES.viewState);
    scopeStorage("cube-b", "", memory());
    expect(storageKey(STORAGE_NAMES.viewState)).not.toBe(a);
    expect(a).toBe("cube:view-state:v1@cube-a");
  });

  it("moves the old unscoped keys into the first cube that opens, once", () => {
    const store = memory({ "maxs-cube:view-state:v1": '{"a":1}' });
    scopeStorage("cube-a", "", store);
    expect(store.data.get("cube:view-state:v1@cube-a")).toBe('{"a":1}');
    expect(store.data.has("maxs-cube:view-state:v1")).toBe(false);
    scopeStorage("cube-b", "", store);
    expect(store.data.has("cube:view-state:v1@cube-b")).toBe(false);
  });

  it("moves a share doc's old snapshot-scoped keys and keeps newer ones", () => {
    const store = memory({
      "maxs-cube:view-search:v1@snap": "old",
      "maxs-cube:insights-layout:v1@snap": "old",
      "cube:insights-layout:v1@snap": "new",
    });
    scopeStorage("snap", "snap", store);
    expect(store.data.get("cube:view-search:v1@snap")).toBe("old");
    expect(store.data.get("cube:insights-layout:v1@snap")).toBe("new");
    expect([...store.data.keys()].some((key) => key.startsWith("maxs-cube:"))).toBe(false);
  });
});
