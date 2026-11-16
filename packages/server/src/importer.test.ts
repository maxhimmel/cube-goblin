import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { createCubeFolder, readCards, readLog, readTags } from "@repo/cube";
import { describe, expect, it } from "vitest";
import { dispatch } from "./routes.ts";
import { createWorkbenchServer } from "./workbench.ts";

const SHOCK = {
  object: "card",
  id: "22222222-2222-4222-8222-222222222222",
  oracle_id: "11111111-1111-4111-8111-111111111111",
  name: "Shock",
  layout: "normal",
  color_identity: ["R"],
  colors: ["R"],
  cmc: 1,
  type_line: "Instant",
  rarity: "common",
  set: "m21",
  collector_number: "159",
  mtgo_id: 81_234,
  scryfall_uri: "https://scryfall.com/card/m21/159/shock",
};

const CUBE_JSON = {
  name: "Burn Cube",
  cards: {
    mainboard: [{ cardID: SHOCK.id, tags: ["Burn"], notes: "cheap", details: { name: "Shock" } }],
    maybeboard: [],
  },
};

const REMOVAL_ORACLE_TAG = "444f824c-f910-4530-9dbe-ede7a84cd7f9";

const ORACLE_TAGS = gzipSync(
  JSON.stringify({
    object: "tag",
    id: REMOVAL_ORACLE_TAG,
    slug: "removal",
    label: "removal",
    type: "oracle",
    taggings: [{ oracle_id: SHOCK.oracle_id }],
  }),
);

interface Seen {
  cubeCobra: string[];
}

function network(seen: Seen): typeof fetch {
  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const reply = (body: unknown, status = 200): Promise<Response> =>
      Promise.resolve(new Response(JSON.stringify(body), { status }));
    if (url.hostname === "cubecobra.com") {
      seen.cubeCobra.push(url.pathname);
      return url.pathname.endsWith("/burn") ? reply(CUBE_JSON) : reply({}, 404);
    }
    if (url.pathname === "/cards/collection" && init?.method === "POST") {
      const body = JSON.parse(typeof init.body === "string" ? init.body : "{}") as {
        identifiers: Record<string, unknown>[];
      };
      const hit = body.identifiers.some(
        (identifier) =>
          identifier["id"] === SHOCK.id ||
          identifier["oracle_id"] === SHOCK.oracle_id ||
          identifier["name"] === "Shock",
      );
      return reply({ object: "list", data: hit ? [SHOCK] : [], not_found: [] });
    }
    if (url.hostname === "data.scryfall.io") {
      return Promise.resolve(new Response(new Uint8Array(ORACLE_TAGS)));
    }
    if (url.pathname.startsWith("/bulk-data/")) {
      return reply({
        object: "bulk_data",
        type: "oracle-tags",
        updated_at: "2026-11-15",
        jsonl_download_uri: "https://data.scryfall.io/tags.jsonl.gz",
      });
    }
    if (url.pathname === "/cards/named") {
      return reply({ object: "error", status: 404, code: "not_found", details: "No card" }, 404);
    }
    return reply({});
  };
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "import-"));
  const folder = await createCubeFolder(join(root, "cubes"), "Mine");
  const seen: Seen = { cubeCobra: [] };
  const server = await createWorkbenchServer({
    cubeDir: folder.dir,
    cacheDir: join(root, "cache"),
    imageCacheDir: join(root, "images"),
    fetch: network(seen),
  });
  const call = async (path: string, init?: RequestInit) => {
    const response = await dispatch(server.routes, new Request(`http://test${path}`, init));
    if (!response) {
      throw new Error(`No response for ${path}`);
    }
    return response;
  };
  const post = (path: string, body: unknown) =>
    call(path, { method: "POST", body: JSON.stringify(body) });
  return { folder, seen, call, post };
}

describe("import and export routes", () => {
  it("previews pasted text with matches, misses, and board statuses", async () => {
    const { post } = await setup();
    const response = await post("/api/import/preview", {
      source: { text: "Deck\n1 Shock\n\nSideboard\n1 Not A Card\n" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      format: "text",
      boards: [
        { board: "main", count: 1, status: "draft" },
        { board: "side", count: 1, status: "prospect" },
      ],
      added: [{ line: 2, card: "Shock", status: "draft", how: "name" }],
      misses: [{ line: 5, name: "Not A Card" }],
    });
  });

  it("skips a line the user blanked and remaps a board", async () => {
    const { post } = await setup();
    const response = await post("/api/import/preview", {
      source: { text: "1 Shock\n1 Not A Card\n" },
      edits: { "2": "" },
      boards: { main: "prospect" },
    });
    expect(await response.json()).toMatchObject({
      added: [{ card: "Shock", status: "prospect" }],
      misses: [],
    });
  });

  it("imports a Cube Cobra cube by URL with tags, notes, and one log entry", async () => {
    const { folder, seen, post } = await setup();
    const response = await post("/api/import", {
      source: { url: "https://cubecobra.com/cube/list/burn" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ added: 1, title: "Burn Cube" });
    expect(seen.cubeCobra).toEqual(["/cube/api/cubeJSON/burn"]);
    expect(await readCards(folder.paths)).toMatchObject([
      {
        name: "Shock",
        status: "draft",
        printing: SHOCK.id,
        tags: ["burn", "removal"],
        notes: "cheap",
      },
    ]);
    expect(await readTags(folder.paths)).toEqual([
      { id: "burn", label: "Burn" },
      { id: "removal", label: "removal" },
    ]);
    expect(await readLog(folder.paths)).toHaveLength(1);
  });

  it("says when a Cube Cobra cube doesn't exist", async () => {
    const { post } = await setup();
    const response = await post("/api/import/preview", { source: { url: "nope" } });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Cube Cobra has no cube "nope"' });
  });

  it("exports the cube as a download and names what the format loses", async () => {
    const { post, call } = await setup();
    await post("/api/import", { source: { text: "1 Shock\n" } });
    const response = await call("/api/export?format=mtgo-dek");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Mine-mtgo-dek.dek"',
    );
    expect(response.headers.get("X-Export-Losses")).toBe("cuts,tags,notes");
    expect(await response.text()).toContain(
      '<Cards CatID="81234" Quantity="1" Sideboard="false" Name="Shock"',
    );
    expect((await call("/api/export?format=nope")).status).toBe(400);
  });
});
