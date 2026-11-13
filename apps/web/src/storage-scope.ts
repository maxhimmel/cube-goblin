let scope = "";

export function scopeStorage(next: string): void {
  scope = next;
}

export function scoped(key: string): string {
  return scope === "" ? key : `${key}@${scope}`;
}
