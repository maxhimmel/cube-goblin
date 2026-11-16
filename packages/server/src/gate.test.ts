import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCubeFolder } from "@repo/cube";
import { beforeAll, describe, expect, it } from "vitest";
import type { CubeHostServer } from "./cubes.ts";
import { createCubeHostServer } from "./cubes.ts";
import { RecentCubes } from "./recent-cubes.ts";

let host: CubeHostServer;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), "gate-"));
  const cube = await createCubeFolder(join(root, "cubes"), "Gate");
  host = await createCubeHostServer({
    cubeDir: cube.dir,
    cacheDir: join(root, "cache"),
    imageCacheDir: join(root, "images"),
    fetch: () => Promise.reject(new TypeError("fetch failed")),
    home: join(root, "cubes"),
    recent: new RecentCubes(join(root, "user-data")),
    openByPath: true,
    hosts: ["bundle"],
  });
});

const SELF = "http://localhost:5173";

const HOSTILE: Record<
  string,
  { base?: string; headers?: Record<string, string>; initiator?: string }
> = {
  "a cross-site page": { headers: { "Sec-Fetch-Site": "cross-site" } },
  "another localhost port (same-site)": { headers: { "Sec-Fetch-Site": "same-site" } },
  "an unknown Sec-Fetch-Site value": { headers: { "Sec-Fetch-Site": "sideways" } },
  "an Origin from another port": { headers: { Origin: "http://localhost:3000" } },
  "Origin null": { headers: { Origin: "null" } },
  "a foreign Host (DNS rebinding)": { base: "http://evil.example:5173" },
  "Electron content from another origin": {
    base: "app://bundle",
    initiator: "https://evil.example",
  },
};

function request(
  method: string,
  path: string,
  options: { base?: string; headers?: Record<string, string>; initiator?: string } = {},
): Request {
  const made = new Request(`${options.base ?? SELF}${path}`, {
    method,
    headers: options.headers ?? {},
  });
  if (options.initiator !== undefined) {
    Object.defineProperty(made, "initiatorOrigin", { value: options.initiator, enumerable: true });
  }
  return made;
}

async function status(made: Request): Promise<number | undefined> {
  return (await host.handle(made))?.status;
}

describe("cross-origin gate", () => {
  it("covers every route in the table", () => {
    expect(host.routes.length).toBeGreaterThan(20);
  });

  for (const [who, options] of Object.entries(HOSTILE)) {
    it(`refuses ${who} on every route`, async () => {
      for (const row of host.routes) {
        expect(
          await status(request(row.method, row.example, options)),
          `${row.method} ${row.example}`,
        ).toBe(403);
      }
    });
  }

  it("refuses unknown /api paths before saying they don't exist", async () => {
    expect(await status(request("GET", "/api/nope", HOSTILE["a cross-site page"]))).toBe(403);
    expect(await status(request("GET", "/api/nope"))).toBe(404);
  });

  it("lets the workbench's own page, Electron's renderer, and tools through", async () => {
    const allowed = [
      request("GET", "/api/config", { headers: { "Sec-Fetch-Site": "same-origin" } }),
      request("GET", "/api/config", { headers: { "Sec-Fetch-Site": "none" } }),
      request("GET", "/api/config", { headers: { Origin: SELF } }),
      request("GET", "/api/config"),
      request("GET", "/api/config", { base: "http://127.0.0.1:5173" }),
      request("GET", "/api/config", { base: "app://bundle", initiator: "app://bundle" }),
      request("GET", "/api/config", { base: "app://bundle" }),
    ];
    for (const made of allowed) {
      expect(await status(made), made.url).toBe(200);
    }
  });

  it("leaves non-API paths to the host", async () => {
    expect(
      await host.handle(request("GET", "/index.html", HOSTILE["a cross-site page"])),
    ).toBeUndefined();
  });
});
