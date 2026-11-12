import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  recallSearch,
  recallState,
  recallStates,
  rememberSearch,
  rememberState,
  replaceStates,
} from "./view-choices.ts";

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
    rememberSearch("/tags", { tags: "removal", card: "x" }, store);
    expect(recallSearch("/tags", {}, store)).toEqual({ tags: "removal" });
    expect(recallSearch("/tags", { card: "y" }, store)).toEqual({ tags: "removal" });
  });

  it("lets a link with its own choices win", () => {
    const store = memory();
    rememberSearch("/tags", { tags: "removal" }, store);
    expect(recallSearch("/tags", { tags: "ramp" }, store)).toBeUndefined();
  });

  it("does not bring back a selection scope", () => {
    const store = memory();
    rememberSearch("/insights", { scope: "selected" }, store);
    expect(recallSearch("/insights", {}, store)).toBeUndefined();
  });

  it("remembers going back to the default", () => {
    const store = memory();
    rememberSearch("/insights", { scope: "all" }, store);
    rememberSearch("/insights", {}, store);
    expect(recallSearch("/insights", {}, store)).toBeUndefined();
  });

  it("keeps each view apart and ignores keys a view does not remember", () => {
    const store = memory();
    rememberSearch("/tags", { tags: "removal", bucket: "curve:2" }, store);
    rememberSearch("/insights", { scope: "all", bucket: "curve:2" }, store);
    expect(recallSearch("/tags", {}, store)).toEqual({ tags: "removal" });
    expect(recallSearch("/insights", {}, store)).toEqual({ scope: "all" });
    expect(recallSearch("/board", {}, store)).toBeUndefined();
  });

  it("survives junk in storage", () => {
    const store = memory();
    store.setItem("maxs-cube:view-search:v1", "{not json");
    store.setItem("maxs-cube:view-state:v1", JSON.stringify({ "wall.trayOpen": "yes" }));
    expect(recallSearch("/board", {}, store)).toBeUndefined();
    expect(recallState("wall.trayOpen", z.boolean(), store)).toBeUndefined();
  });

  it("round-trips component state", () => {
    const store = memory();
    rememberState("board.poolStatus", "draft", store);
    rememberState("wall.trayOpen", false, store);
    expect(recallState("board.poolStatus", z.enum(["all", "draft"]), store)).toBe("draft");
    expect(recallState("wall.trayOpen", z.boolean(), store)).toBe(false);
  });

  it("snapshots and replaces a group of remembered states", () => {
    const store = memory();
    const lab = (key: string): boolean => key.startsWith("lab.");
    rememberState("lab.axis", "none", store);
    rememberState("lab.hide", true, store);
    rememberState("wall.other", 1, store);
    const snapshot = recallStates(lab, store);
    expect(snapshot).toEqual({ "lab.axis": "none", "lab.hide": true });
    rememberState("lab.axis", "mv", store);
    rememberState("lab.extra", 2, store);
    replaceStates(lab, { ...snapshot, "wall.other": 9 }, store);
    expect(recallStates(() => true, store)).toEqual({
      "wall.other": 1,
      "lab.axis": "none",
      "lab.hide": true,
    });
  });
});
