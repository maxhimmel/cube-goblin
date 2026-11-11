import { describe, expect, it } from "vitest";
import { layoutsFileSchema, newLayoutId } from "./layouts.ts";

describe("layoutsFileSchema", () => {
  it("keeps any settings under a named layout", () => {
    const file = {
      layouts: [{ id: "layout-a", label: "Curve check", settings: { "lab.axis": "none" } }],
    };
    expect(layoutsFileSchema.parse(file)).toEqual(file);
  });

  it("rejects duplicate ids, blank labels, and unknown fields", () => {
    const layout = { id: "layout-a", label: "A", settings: {} };
    expect(layoutsFileSchema.safeParse({ layouts: [layout, layout] }).success).toBe(false);
    expect(layoutsFileSchema.safeParse({ layouts: [{ ...layout, label: "  " }] }).success).toBe(
      false,
    );
    expect(layoutsFileSchema.safeParse({ layouts: [{ ...layout, extra: 1 }] }).success).toBe(false);
  });
});

describe("newLayoutId", () => {
  it("skips ids already taken", () => {
    const ids = ["aaa", "bbb"];
    expect(newLayoutId([{ id: "layout-aaa" }], () => ids.shift() ?? "zzz")).toBe("layout-bbb");
  });
});
