export const CUBECOBRA_ORIGIN = "https://cubecobra.com";

const CUBE_PATH = /^\/cube\/(?:[^/]+\/)+([^/]+)\/?$/u;
const BARE_ID = /^[\w-]+$/u;

export function cubeCobraId(input: string): string | undefined {
  const text = input.trim();
  if (BARE_ID.test(text)) {
    return text;
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return undefined;
  }
  if (!/(^|\.)cubecobra\.com$/iu.test(url.hostname)) {
    return undefined;
  }
  const match = CUBE_PATH.exec(url.pathname);
  return match?.[1] === undefined ? undefined : decodeURIComponent(match[1]);
}

export function isCubeCobraSource(input: string): boolean {
  return /^https?:\/\/(?:www\.)?cubecobra\.com\//iu.test(input.trim());
}

export interface FetchCubeOptions {
  userAgent: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const RETRY_MS = 5000;

export async function fetchCubeCobra(id: string, options: FetchCubeOptions): Promise<string> {
  const send = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((done) => setTimeout(done, ms)));
  const url = `${CUBECOBRA_ORIGIN}/cube/api/cubeJSON/${encodeURIComponent(id)}`;
  const init = { headers: { "User-Agent": options.userAgent, Accept: "application/json" } };
  let response = await send(url, init);
  if (response.status === 429) {
    const after = Number(response.headers.get("Retry-After"));
    await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : RETRY_MS);
    response = await send(url, init);
  }
  if (response.status === 404) {
    throw new Error(`Cube Cobra has no cube "${id}"`);
  }
  if (!response.ok) {
    throw new Error(`Cube Cobra answered ${String(response.status)} for cube "${id}"`);
  }
  return response.text();
}
