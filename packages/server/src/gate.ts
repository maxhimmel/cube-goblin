import { API_PREFIX } from "./routes.ts";

export interface GateOptions {
  hosts: readonly string[];
}

const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];
const TRUSTED_FETCH_SITES = new Set(["same-origin", "none"]);

export function originOf(url: URL): string {
  return `${url.protocol}//${url.host}`;
}

function initiatorOrigin(request: Request): unknown {
  return Object.prototype.hasOwnProperty.call(request, "initiatorOrigin")
    ? (request as Request & { initiatorOrigin?: unknown }).initiatorOrigin
    : undefined;
}

function refusal(request: Request, url: URL, options: GateOptions): string | undefined {
  if (!LOOPBACK.includes(url.hostname) && !options.hosts.includes(url.hostname)) {
    return `host ${url.hostname} isn't this workbench`;
  }
  const self = originOf(url);
  const initiator = initiatorOrigin(request);
  if (initiator !== undefined) {
    return initiator === self ? undefined : "the request came from another origin";
  }
  const site = request.headers.get("Sec-Fetch-Site");
  if (site !== null) {
    return TRUSTED_FETCH_SITES.has(site) ? undefined : `the request came from a ${site} page`;
  }
  const origin = request.headers.get("Origin");
  if (origin !== null) {
    return origin === self ? undefined : "the request came from another origin";
  }
  return undefined;
}

export function crossOriginGate(request: Request, options: GateOptions): Response | undefined {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(API_PREFIX)) {
    return undefined;
  }
  const reason = refusal(request, url, options);
  return reason === undefined
    ? undefined
    : new Response(`Forbidden: ${reason}`, {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8", Vary: "Sec-Fetch-Site, Origin" },
      });
}
