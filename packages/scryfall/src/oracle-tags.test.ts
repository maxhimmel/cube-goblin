import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ScryfallClient } from "./client.ts";
import { OracleTagStore, indexOracleTags, parseTagLines } from "./oracle-tags.ts";

function tag(id: string, oracleIds: string[], childIds: string[] = []) {
  return {
    object: "tag",
    id,
    slug: id,
    label: id,
    type: "oracle",
    child_ids: childIds,
    taggings: oracleIds.map((oracleId) => ({ oracle_id: oracleId, weight: "median" })),
  };
}

const TAGS = [
  tag("removal", [], ["destroy", "exile"]),
  tag("destroy", ["bolt", "murder"]),
  tag("exile", ["swords", "murder"], ["destroy"]),
  tag("ramp", ["elf"]),
];

const LINES = TAGS.map((entry) => JSON.stringify(entry)).join("\n");

const BULK = {
  object: "bulk_data",
  type: "oracle_tags",
  updated_at: "2026-11-09T10:00:00Z",
  jsonl_download_uri: "https://data.scryfall.io/oracle-tags/x.jsonl.gz",
};

function fakeFetch(urls: string[], fail = false): typeof fetch {
  return (input) => {
    const url =
      input instanceof URL ? input.toString() : typeof input === "string" ? input : input.url;
    urls.push(url);
    if (fail) {
      return Promise.reject(new Error("offline"));
    }
    if (url.endsWith(".jsonl.gz")) {
      return Promise.resolve(new Response(gzipSync(LINES)));
    }
    return Promise.resolve(new Response(JSON.stringify(BULK)));
  };
}

async function tempFile(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), "otags-")), "oracle-tags.json");
}

describe("indexOracleTags", () => {
  it("walks child tags, dedupes, and survives cycles", () => {
    const index = indexOracleTags(parseTagLines(LINES), ["removal", "ramp", "missing"]);
    expect(index).toEqual({
      removal: ["bolt", "murder", "swords"],
      ramp: ["elf"],
      missing: [],
    });
  });
});

describe("OracleTagStore", () => {
  it("downloads once, then serves the cached index", async () => {
    const urls: string[] = [];
    const file = await tempFile();
    const client = new ScryfallClient({ userAgent: "Test/1.0", fetch: fakeFetch(urls) });
    const store = new OracleTagStore({ client, file, now: () => 1000 });
    const first = await store.load(["ramp"]);
    const second = await store.load(["ramp"]);
    expect(first).toEqual({ index: { ramp: ["elf"] }, fetchedAt: 1000, stale: false });
    expect(second.index).toEqual({ ramp: ["elf"] });
    expect(urls).toEqual([
      "https://api.scryfall.com/bulk-data/oracle-tags",
      "https://data.scryfall.io/oracle-tags/x.jsonl.gz",
    ]);
  });

  it("falls back to a stale cache when offline", async () => {
    const file = await tempFile();
    await writeFile(
      file,
      JSON.stringify({ fetchedAt: 0, roots: ["ramp"], index: { ramp: ["elf"] } }),
    );
    const client = new ScryfallClient({ userAgent: "Test/1.0", fetch: fakeFetch([], true) });
    const store = new OracleTagStore({ client, file, now: () => 10 * 24 * 60 * 60 * 1000 });
    const result = await store.load(["ramp"]);
    expect(result).toMatchObject({ index: { ramp: ["elf"] }, stale: true, error: "offline" });
    expect(JSON.parse(await readFile(file, "utf8"))).toMatchObject({ fetchedAt: 0 });
  });

  it("returns an empty index when offline with no cache", async () => {
    const client = new ScryfallClient({ userAgent: "Test/1.0", fetch: fakeFetch([], true) });
    const store = new OracleTagStore({ client, file: await tempFile() });
    expect(await store.load(["ramp"])).toMatchObject({ index: {}, stale: true });
  });

  it("refetches when asked for a tag the cache lacks", async () => {
    const urls: string[] = [];
    const file = await tempFile();
    await writeFile(
      file,
      JSON.stringify({ fetchedAt: 1000, roots: ["ramp"], index: { ramp: ["elf"] } }),
    );
    const client = new ScryfallClient({ userAgent: "Test/1.0", fetch: fakeFetch(urls) });
    const store = new OracleTagStore({ client, file, now: () => 1000 });
    const result = await store.load(["ramp", "removal"]);
    expect(result.index["removal"]).toEqual(["bolt", "murder", "swords"]);
    expect(urls).toHaveLength(2);
  });

  it("refuses downloads from other hosts", async () => {
    const client = new ScryfallClient({ userAgent: "Test/1.0", fetch: fakeFetch([]) });
    await expect(client.download("https://evil.example/x.gz")).rejects.toThrow(/Refusing/u);
  });
});
