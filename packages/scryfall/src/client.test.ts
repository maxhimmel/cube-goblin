import { describe, expect, it } from "vitest";
import { MemoryCache } from "./cache.ts";
import { CARD_ENDPOINT_INTERVAL_MS, ScryfallClient, ScryfallError, chunk } from "./client.ts";

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
    expect(sleeps).toEqual([CARD_ENDPOINT_INTERVAL_MS, 2 * CARD_ENDPOINT_INTERVAL_MS]);
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
