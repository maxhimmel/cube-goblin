export const STORAGE_NAMES = {
  viewSearch: "view-search:v1",
  viewState: "view-state:v1",
  insightsLayout: "insights-layout:v1",
} as const;

type StorageName = (typeof STORAGE_NAMES)[keyof typeof STORAGE_NAMES];

const PREFIX = "cube:";
const LEGACY_PREFIX = "maxs-cube:";

let scope = "";

interface MovableStore {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function browserStore(): MovableStore | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function withScope(key: string, at: string): string {
  return at === "" ? key : `${key}@${at}`;
}

export function storageKey(name: StorageName): string {
  return withScope(`${PREFIX}${name}`, scope);
}

export function adoptLegacyKey(
  legacy: string,
  next: string,
  store: MovableStore | undefined = browserStore(),
): void {
  try {
    const old = store?.getItem(legacy);
    if (old === null || old === undefined) {
      return;
    }
    if (store?.getItem(next) === null) {
      store.setItem(next, old);
    }
    store?.removeItem(legacy);
  } catch {
    return;
  }
}

export function scopeStorage(
  next: string,
  legacyScope: string,
  store: MovableStore | undefined = browserStore(),
): void {
  scope = next;
  for (const name of Object.values(STORAGE_NAMES)) {
    adoptLegacyKey(withScope(`${LEGACY_PREFIX}${name}`, legacyScope), storageKey(name), store);
  }
}
