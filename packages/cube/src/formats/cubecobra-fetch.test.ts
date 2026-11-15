import { describe, expect, it } from "vitest";
import { cubeCobraId, fetchCubeCobra, isCubeCobraSource } from "./cubecobra-fetch.ts";

describe("Cube Cobra source", () => {
  it.each([
    ["https://cubecobra.com/cube/list/vintage", "vintage"],
    [
      "https://cubecobra.com/cube/overview/5d2cb3f44153591614458e5d?view=x",
      "5d2cb3f44153591614458e5d",
    ],
    ["https://www.cubecobra.com/cube/api/cubeJSON/abc-123", "abc-123"],
    ["my-cube", "my-cube"],
    ["https://example.com/cube/list/vintage", undefined],
    ["https://cubecobra.com/", undefined],
  ])("%s", (input, id) => {
    expect(cubeCobraId(input)).toBe(id);
  });

  it("tells URLs from file paths", () => {
    expect(isCubeCobraSource("https://cubecobra.com/cube/list/x")).toBe(true);
    expect(isCubeCobraSource("./list.txt")).toBe(false);
  });

  it("sends one request with our User-Agent and backs off once on 429", async () => {
    const seen: { url: string; agent: string | null }[] = [];
    const waits: number[] = [];
    const answers = [
      new Response("", { status: 429, headers: { "Retry-After": "2" } }),
      new Response("{}"),
    ];
    const text = await fetchCubeCobra("vintage", {
      userAgent: "Test/1",
      fetch: (url, init) => {
        seen.push({
          url: url instanceof Request ? url.url : url.toString(),
          agent: new Headers(init?.headers).get("User-Agent"),
        });
        return Promise.resolve(answers.shift() ?? new Response("", { status: 500 }));
      },
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    expect(text).toBe("{}");
    expect(waits).toEqual([2000]);
    expect(seen).toEqual([
      { url: "https://cubecobra.com/cube/api/cubeJSON/vintage", agent: "Test/1" },
      { url: "https://cubecobra.com/cube/api/cubeJSON/vintage", agent: "Test/1" },
    ]);
  });

  it("says when a cube doesn't exist", async () => {
    await expect(
      fetchCubeCobra("nope", {
        userAgent: "T",
        fetch: () => Promise.resolve(new Response("", { status: 404 })),
      }),
    ).rejects.toThrow('Cube Cobra has no cube "nope"');
  });
});
