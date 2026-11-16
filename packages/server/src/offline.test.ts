import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { createCubeFolder } from "@repo/cube";
import { describe, expect, it } from "vitest";
import { dispatch } from "./routes.ts";
import { createWorkbenchServer } from "./workbench.ts";

const ORACLE_ID = "11111111-1111-4111-8111-111111111111";
const card = {
  object: "card",
  id: "22222222-2222-4222-8222-222222222222",
  oracle_id: ORACLE_ID,
  name: "Shock",
  layout: "normal",
  color_identity: ["R"],
  rarity: "common",
  set: "m21",
  collector_number: "159",
  scryfall_uri: "https://scryfall.com/card/m21/159/shock",
  image_uris: {
    small: "https://cards.scryfall.io/small/shock.jpg",
    large: "https://cards.scryfall.io/large/shock.jpg",
  },
};
const tags = gzipSync(
  JSON.stringify({
    object: "tag",
    id: "t",
    slug: "removal",
    label: "removal",
    type: "oracle",
    taggings: [{ oracle_id: ORACLE_ID }],
  }),
);

function scryfall(network: { up: boolean }): typeof fetch {
  return (input, init) => {
    if (!network.up) {
      return Promise.reject(new TypeError("fetch failed"));
    }
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const reply = (body: unknown): Promise<Response> =>
      Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    if (url.hostname === "cards.scryfall.io") {
      return Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }),
      );
    }
    if (url.hostname === "data.scryfall.io") {
      return Promise.resolve(new Response(new Uint8Array(tags)));
    }
    if (url.pathname === "/cards/collection" && init?.method === "POST") {
      return reply({ object: "list", data: [card] });
    }
    if (url.pathname === "/cards/search") {
      return reply({ object: "list", data: [card], has_more: false });
    }
    if (url.pathname.startsWith("/bulk-data/")) {
      return reply({
        object: "bulk_data",
        type: "oracle-tags",
        updated_at: "2026-11-15",
        jsonl_download_uri: "https://data.scryfall.io/tags.jsonl.gz",
      });
    }
    return reply({});
  };
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "offline-"));
  const folder = await createCubeFolder(join(root, "cubes"), "Burn");
  const network = { up: true };
  const server = await createWorkbenchServer({
    cubeDir: folder.dir,
    cacheDir: join(root, "cache"),
    imageCacheDir: join(root, "images"),
    fetch: scryfall(network),
  });
  const call = async (path: string, init?: RequestInit) => {
    const response = await dispatch(server.routes, new Request(`http://test${path}`, init));
    if (!response) {
      throw new Error(`No response for ${path}`);
    }
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
  return { folder, network, server, call };
}

async function settled(call: Awaited<ReturnType<typeof setup>>["call"]) {
  for (;;) {
    const { body } = await call("/api/offline");
    const run = body["run"] as { running: boolean } | undefined;
    if (run?.running === false) {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe("offline", () => {
  it("caches a cube and serves it with the network cut", async () => {
    const { folder, network, server, call } = await setup();
    const added = await call("/api/cards", {
      method: "POST",
      body: JSON.stringify({ oracleId: ORACLE_ID, status: "prospect" }),
    });
    expect(added.status).toBe(200);
    expect((await call("/api/offline")).body).toMatchObject({ cards: 1, complete: false });

    expect((await call("/api/offline", { method: "POST" })).status).toBe(202);
    const status = await settled(call);
    expect(status).toMatchObject({
      cards: 1,
      cached: 1,
      complete: true,
      run: { done: 1, total: 1, failed: 0 },
    });
    expect(status["bytes"]).toBeGreaterThan(6);
    expect(await server.offlineStatus(folder.dir)).toMatchObject({ complete: true });

    network.up = false;
    expect((await call("/api/cube")).status).toBe(200);
    const printings = await call("/api/cards/shock/printings");
    expect(printings.status).toBe(503);
    expect(printings.body["error"]).toMatch(/printings need a connection/u);
    const search = await call("/api/search?q=bolt");
    expect(search.status).toBe(503);
    expect(search.body["error"]).toMatch(/Scryfall can't be reached/u);
    expect((await call("/api/connection")).body).toEqual({ online: false });
    const edit = await call("/api/cards/shock", {
      method: "PATCH",
      body: JSON.stringify({ notes: "offline note" }),
    });
    expect(edit.status).toBe(200);
  }, 20_000);
});
