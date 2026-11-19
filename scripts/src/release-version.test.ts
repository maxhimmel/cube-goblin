import { describe, expect, it } from "vitest";
import { nextVersion } from "./release-version.ts";

describe("nextVersion", () => {
  it("bumps each part", () => {
    expect(nextVersion("0.1.9", "patch")).toBe("0.1.10");
    expect(nextVersion("0.1.9", "minor")).toBe("0.2.0");
    expect(nextVersion("0.1.9", "major")).toBe("1.0.0");
  });

  it("takes an explicit newer version", () => {
    expect(nextVersion("0.1.0", "0.3.0")).toBe("0.3.0");
  });

  it("rejects versions that are not newer or not X.Y.Z", () => {
    expect(() => nextVersion("0.2.0", "0.1.5")).toThrow("not newer");
    expect(() => nextVersion("0.2.0", "0.2.0")).toThrow("not newer");
    expect(() => nextVersion("0.2.0", "v0.3.0")).toThrow("not X.Y.Z");
  });
});
