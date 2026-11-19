const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/u;

function parts(version: string): [number, number, number] {
  const match = SEMVER.exec(version);
  if (match === null) {
    throw new Error(`"${version}" is not X.Y.Z`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isNewer(next: string, current: string): boolean {
  const a = parts(next);
  const b = parts(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return (a[i] ?? 0) > (b[i] ?? 0);
    }
  }
  return false;
}

export function nextVersion(current: string, request: string): string {
  const [major, minor, patch] = parts(current);
  const bumped: Record<string, number[]> = {
    patch: [major, minor, patch + 1],
    minor: [major, minor + 1, 0],
    major: [major + 1, 0, 0],
  };
  const next = bumped[request]?.join(".") ?? request;
  parts(next);
  if (!isNewer(next, current)) {
    throw new Error(`${next} is not newer than ${current}`);
  }
  return next;
}
