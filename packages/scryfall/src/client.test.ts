import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileCache, MemoryCache } from "./cache.ts";
import {
  CARD_ENDPOINT_INTERVAL_MS,
  RATE_LIMIT_COOLDOWN_MS,
  ScryfallClient,
  ScryfallError,
  chunk,
} from "./client.ts";

const card = {
  object: "card",
  id: "1",
  name: "Entomb",
  layout: "normal",
  color_identity: ["B"],
  rarity: "rare",
  set: "dmr",
  collector_number: "82",
  scryfall_uri: "https://scryfall.com/card/dmr/82/entomb",
};

interface Call {
  url: string;
  init: RequestInit | undefined;
}

function fakeFetch(responses: { status: number; body: unknown }[], calls: Call[]): typeof fetch {
  return (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) {
      throw new Error("unexpected request");
    }
    return Promise.resolve(new Response(JSON.stringify(next.body), { status: next.status }));
  };
}

describe("ScryfallClient", () => {
  it("sends required headers and parses a card", async () => {
    const calls: Call[] = [];
    const client = new ScryfallClient({
      userAgent: "Test/1.0",
      fetch: fakeFetch([{ status: 200, body: card }], calls),
    });
    const result = await client.named("Entomb");
    expect(result.name).toBe("Entomb");
    expect(calls[0]?.url).toBe("https://api.scryfall.com/cards/named?exact=Entomb");
    expect(calls[0]?.init?.headers).toMatchObject({
      "User-Agent": "Test/1.0",
      Accept: "application/json",
    });
  });

  it("serves repeat requests from cache", async () => {
    const calls: Call[] = [];
    const client = new ScryfallClient({
      userAgent: "Test/1.0",
      cache: new MemoryCache(),
      fetch: fakeFetch([{ status: 200, body: card }], calls),
    });
    await client.named("Entomb");
    await client.named("Entomb");
    expect(calls).toHaveLength(1);
  });

  it("waits between card endpoint requests", async () => {
    const calls: Call[] = [];
    const sleeps: number[] = [];
    let clock = 0;
    const client = new ScryfallClient({
      userAgent: "Test/1.0",
      fetch: fakeFetch(
        [
          { status: 200, body: card },
          { status: 200, body: { ...card, name: "Reanimate" } },
        ],
        calls,
      ),
      now: () => clock,
      sleep: (ms) => {
        sleeps.push(ms);
        clock += ms;
        return Promise.resolve();
      },
    });
    await client.named("Entomb");
    await client.named("Reanimate");
    expect(sleeps).toEqual([CARD_ENDPOINT_INTERVAL_MS]);
  });

  it("spaces out concurrent card endpoint requests", async () => {
    const calls: Call[] = [];
    const sleeps: number[] = [];
    const client = new ScryfallClient({
      userAgent: "Test/1.0",
      fetch: fakeFetch(
        ["Entomb", "Reanimate", "Exhume"].map((name) => ({ status: 200, body: { ...card, name } })),
        calls,
      ),
      now: () => 0,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });
    await Promise.all([client.named("Entomb"), client.named("Reanimate"), client.named("Exhume")]);
    expect(sleeps).toEqual([CARD_ENDPOINT_INTERVAL_MS, CARD_ENDPOINT_INTERVAL_MS]);
  });

  it("stops calling Scryfall for a minute after a 429", async () => {
    const calls: Call[] = [];
    let clock = 0;
    const limited = { object: "error", status: 429, code: "rate_limited", details: "Slow down" };
    const client = new ScryfallClient({
      userAgent: "Test/1.0",
      fetch: fakeFetch(
        [
          { status: 429, body: limited },
          { status: 200, body: card },
        ],
        calls,
      ),
      now: () => clock,
      sleep: (ms) => {
        clock += ms;
        return Promise.resolve();
      },
    });
    await expect(client.named("Entomb")).rejects.toThrow("Slow down");
    await expect(client.named("Entomb")).rejects.toThrow("try again in a minute");
    expect(calls).toHaveLength(1);
    clock += RATE_LIMIT_COOLDOWN_MS;
    expect((await client.named("Entomb")).name).toBe("Entomb");
    expect(calls).toHaveLength(2);
  });

  it("caches cards per oracle id, so an added card costs one small request", async () => {
    const calls: Call[] = [];
    const named = (id: string, name: string) => ({ ...card, id, oracle_id: id, name });
    const cache = new MemoryCache();
    const options = { userAgent: "Test/1.0", cache, sleep: () => Promise.resolve() };
    const first = new ScryfallClient({
      ...options,
      fetch: fakeFetch(
        [{ status: 200, body: { object: "list", data: [named("a", "A"), named("b", "B")] } }],
        calls,
      ),
    });
    expect((await first.byOracleIds(["a", "b"])).cards.map((c) => c.name)).toEqual(["A", "B"]);

    const second = new ScryfallClient({
      ...options,
      fetch: fakeFetch(
        [{ status: 200, body: { object: "list", data: [named("c", "C")], not_found: [{}] } }],
        calls,
      ),
    });
    const result = await second.byOracleIds(["c", "a", "x", "b"]);
    expect(result.cards.map((c) => c.name)).toEqual(["C", "A", "B"]);
    expect(result.missing).toEqual(["x"]);
    expect(calls).toHaveLength(2);
    expect(JSON.parse(calls[1]?.init?.body as string)).toEqual({
      identifiers: [{ oracle_id: "c" }, { oracle_id: "x" }],
    });
  });

  it("uses a chosen printing when it matches the card, else the default printing", async () => {
    const calls: Call[] = [];
    const print = (id: string, oracleId: string, set: string) => ({
      ...card,
      id,
      oracle_id: oracleId,
      set,
    });
    const client = new ScryfallClient({
      userAgent: "Test/1.0",
      cache: new MemoryCache(),
      sleep: () => Promise.resolve(),
      fetch: fakeFetch(
        [
          {
            status: 200,
            body: { object: "list", data: [print("d1", "a", "dmr"), print("d2", "b", "dmr")] },
          },
          {
            status: 200,
            body: { object: "list", data: [print("p1", "a", "spg"), print("p2", "z", "sld")] },
          },
        ],
        calls,
      ),
    });
    const { cards, missing, unresolved } = await client.forEntries([
      { oracleId: "a", printing: "p1" },
      { oracleId: "b", printing: "p2" },
    ]);
    expect(cards.get("a")?.set).toBe("spg");
    expect(cards.get("b")?.id).toBe("d2");
    expect(missing).toEqual([]);
    expect(unresolved).toEqual(["b"]);
    expect(JSON.parse(calls[1]?.init?.body as string)).toEqual({
      identifiers: [{ id: "p1" }, { id: "p2" }],
    });
  });

  it("serves stale cached cards when Scryfall can't be reached", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scryfall-stale-"));
    await new FileCache(dir).set("print:p1", { ...card, id: "p1", oracle_id: "a" });
    const later = new FileCache(dir, 1000, () => Date.now() + 10_000);
    const offline = new ScryfallClient({
      userAgent: "Test/1.0",
      cache: later,
      sleep: () => Promise.resolve(),
      fetch: () => Promise.reject(new TypeError("fetch failed")),
    });
    expect((await offline.byIds(["p1"])).cards.map((found) => found.id)).toEqual(["p1"]);
    await expect(offline.byIds(["p2"])).rejects.toThrow("fetch failed");
    const fresh = await offline
      .forEntries([{ oracleId: "a", printing: "p2" }])
      .catch((error: unknown) => error);
    expect(fresh).toBeInstanceOf(TypeError);
  });

  it("falls back to the default when a new printing can't be fetched offline", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scryfall-offline-"));
    await new FileCache(dir).set("oracle:a", { ...card, id: "d1", oracle_id: "a" });
    const offline = new ScryfallClient({
      userAgent: "Test/1.0",
      cache: new FileCache(dir),
      sleep: () => Promise.resolve(),
      fetch: () => Promise.reject(new TypeError("fetch failed")),
    });
    const { cards, unresolved } = await offline.forEntries([{ oracleId: "a", printing: "p9" }]);
    expect(cards.get("a")?.id).toBe("d1");
    expect(unresolved).toEqual(["a"]);
  });

  it("does not hide Scryfall rejecting a request behind stale data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "scryfall-reject-"));
    await new FileCache(dir).set("print:p1", { ...card, id: "p1" });
    const client = new ScryfallClient({
      userAgent: "Test/1.0",
      cache: new FileCache(dir, 1000, () => Date.now() + 10_000),
      sleep: () => Promise.resolve(),
      fetch: fakeFetch(
        [{ status: 400, body: { object: "error", status: 400, code: "bad", details: "Bad" } }],
        [],
      ),
    });
    await expect(client.byIds(["p1"])).rejects.toThrow("Bad");
  });

  it("serves the last printings list when Scryfall can't be reached", async () => {
    const cache = new MemoryCache();
    const online = new ScryfallClient({
      userAgent: "Test/1.0",
      cache,
      sleep: () => Promise.resolve(),
      fetch: fakeFetch([{ status: 200, body: { object: "list", data: [card] } }], []),
    });
    await online.printings("abc");
    const offline = new ScryfallClient({
      userAgent: "Test/1.0",
      cache,
      sleep: () => Promise.resolve(),
      fetch: () => Promise.reject(new TypeError("fetch failed")),
    });
    expect((await offline.printings("abc")).map((printing) => printing.id)).toEqual(["1"]);
    await expect(offline.printings("other")).rejects.toThrow("fetch failed");
  });

  it("reports what the cache holds for an entry", async () => {
    const cache = new MemoryCache();
    const client = new ScryfallClient({ userAgent: "Test/1.0", cache });
    await cache.set("oracle:a", card);
    await cache.set("print:p1", { ...card, id: "p1" });
    const chosen = await client.cachedEntry({ oracleId: "a", printing: "p1" });
    expect(chosen.card?.id).toBe("p1");
    expect(chosen.missing).toEqual(["printings:a"]);
    expect(chosen.bytes).toBeGreaterThan(0);
    const plain = await client.cachedEntry({ oracleId: "a" });
    expect(plain.card?.id).toBe("1");
    const none = await client.cachedEntry({ oracleId: "b" });
    expect(none).toEqual({ card: undefined, bytes: 0, missing: ["oracle:b", "printings:b"] });
  });

  it("returns no printings when Scryfall finds none", async () => {
    const client = new ScryfallClient({
      userAgent: "Test/1.0",
      sleep: () => Promise.resolve(),
      fetch: fakeFetch(
        [{ status: 404, body: { object: "error", status: 404, code: "not_found", details: "x" } }],
        [],
      ),
    });
    expect(await client.printings("none")).toEqual([]);
  });

  it("lists every paper printing of a card across pages", async () => {
    const calls: Call[] = [];
    const client = new ScryfallClient({
      userAgent: "Test/1.0",
      sleep: () => Promise.resolve(),
      fetch: fakeFetch(
        [
          { status: 200, body: { object: "list", data: [card], has_more: true } },
          { status: 200, body: { object: "list", data: [{ ...card, id: "2" }] } },
        ],
        calls,
      ),
    });
    expect((await client.printings("abc")).map((printing) => printing.id)).toEqual(["1", "2"]);
    const url = new URL(calls[0]?.url ?? "");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "oracleid:abc game:paper",
      unique: "prints",
      include_variations: "true",
      order: "released",
      dir: "desc",
      page: "1",
    });
    expect(new URL(calls[1]?.url ?? "").searchParams.get("page")).toBe("2");
  });

  it("throws ScryfallError with the API error details", async () => {
    const client = new ScryfallClient({
      userAgent: "Test/1.0",
      fetch: fakeFetch(
        [
          {
            status: 404,
            body: {
              object: "error",
              status: 404,
              code: "not_found",
              details: "No card found",
              type: "ambiguous",
            },
          },
        ],
        [],
      ),
    });
    await expect(client.named("Nope")).rejects.toThrow(ScryfallError);
  });

  it("batches collection lookups by 75", async () => {
    const calls: Call[] = [];
    const list = { object: "list", data: [card], has_more: false, not_found: [] };
    const client = new ScryfallClient({
      userAgent: "Test/1.0",
      fetch: fakeFetch(
        [
          { status: 200, body: list },
          { status: 200, body: list },
        ],
        calls,
      ),
      sleep: () => Promise.resolve(),
    });
    const names = Array.from({ length: 76 }, (_, index) => ({ name: `Card ${String(index)}` }));
    await client.collection(names);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.init?.method).toBe("POST");
  });
});

describe("chunk", () => {
  it("splits into fixed-size groups", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
