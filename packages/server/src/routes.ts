export interface RouteContext {
  request: Request;
  url: URL;
  params: readonly string[];
}

export interface RouteRow {
  method: string;
  path: string | RegExp;
  example: string;
  handle: (context: RouteContext) => Promise<Response>;
}

export const API_PREFIX = "/api/";

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function paramsOf(row: RouteRow, path: string): string[] | undefined {
  if (typeof row.path === "string") {
    return row.path === path ? [] : undefined;
  }
  const found = row.path.exec(path);
  return found === null ? undefined : found.slice(1).map((value) => value);
}

export async function dispatch(
  rows: readonly RouteRow[],
  request: Request,
): Promise<Response | undefined> {
  const url = new URL(request.url);
  for (const row of rows) {
    if (row.method !== request.method) {
      continue;
    }
    const params = paramsOf(row, url.pathname);
    if (params !== undefined) {
      return row.handle({ request, url, params });
    }
  }
  if (url.pathname.startsWith(API_PREFIX)) {
    return json(404, { error: `No route ${request.method} ${url.pathname}` });
  }
  return undefined;
}
