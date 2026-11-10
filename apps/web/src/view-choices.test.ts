import { describe, expect, it } from "vitest";
import { z } from "zod";
import { recallSearch, recallState, rememberSearch, rememberState } from "./view-choices.ts";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("view choices", () => {
  it("brings back a view's remembered search when it opens bare", () => {
    const store = memory();
    rememberSearch("/", { by: "color", with: "removal", card: "x" }, store);
    expect(recallSearch("/", {}, store)).toEqual({ by: "color", with: "removal" });
    expect(recallSearch("/", { card: "y" }, store)).toEqual({ by: "color", with: "removal" });
  });

  it("lets a link with its own choices win", () => {
    const store = memory();
    rememberSearch("/", { by: "color" }, store);
    expect(recallSearch("/", { with: "ramp" }, store)).toBeUndefined();
  });

  it("remembers going back to the default", () => {
    const store = memory();
    rememberSearch("/insights", { scope: "all" }, store);
    rememberSearch("/insights", {}, store);
    expect(recallSearch("/insights", {}, store)).toBeUndefined();
  });

  it("keeps each view apart and ignores keys a view does not remember", () => {
    const store = memory();
    rememberSearch("/cards", { by: "tag", bucket: "curve:2" }, store);
    rememberSearch("/insights", { scope: "all", bucket: "curve:2" }, store);
    expect(recallSearch("/cards", {}, store)).toEqual({ by: "tag" });
    expect(recallSearch("/insights", {}, store)).toEqual({ scope: "all" });
    expect(recallSearch("/", {}, store)).toBeUndefined();
  });

  it("survives junk in storage", () => {
    const store = memory();
    store.setItem("maxs-cube:view-search:v1", "{not json");
    store.setItem("maxs-cube:view-state:v1", JSON.stringify({ "wall.trayOpen": "yes" }));
    expect(recallSearch("/", {}, store)).toBeUndefined();
    expect(recallState("wall.trayOpen", z.boolean(), store)).toBeUndefined();
  });

  it("round-trips component state", () => {
    const store = memory();
    rememberState("board.poolStatus", "draft", store);
    rememberState("wall.trayOpen", false, store);
    expect(recallState("board.poolStatus", z.enum(["all", "draft"]), store)).toBe("draft");
    expect(recallState("wall.trayOpen", z.boolean(), store)).toBe(false);
  });
});
