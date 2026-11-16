import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCubeFolder, readConfig } from "@repo/cube";
import { beforeEach, describe, expect, it } from "vitest";
import type { WorkbenchServer } from "./workbench.ts";
import { dispatch } from "./routes.ts";
import { createWorkbenchServer } from "./workbench.ts";

let root: string;
let server: WorkbenchServer;

async function config(): Promise<unknown> {
  const response = await dispatch(server.routes, new Request("http://test/api/config"));
  return response?.json();
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "server-"));
  const first = await createCubeFolder(join(root, "cubes"), "First");
  server = await createWorkbenchServer({
    cubeDir: first.dir,
    cacheDir: join(root, "cache"),
    imageCacheDir: join(root, "images"),
  });
});

describe("workbench server", () => {
  it("switches to another cube folder", async () => {
    expect(await config()).toMatchObject({ name: "First" });
    const second = await createCubeFolder(join(root, "cubes"), "Second");
    await server.open(second.dir);
    expect(await config()).toMatchObject({ name: "Second" });
    expect(server.cube().dir).toBe(second.dir);
    expect(server.isCubeFile(join(second.dir, "cards", "x.json"))).toBe(true);
    expect(server.isCubeFile(join(root, "cubes", "first", "cards", "x.json"))).toBe(false);
  });

  it("refuses an edit sent for a cube that is no longer open", async () => {
    const first = server.cube();
    const second = await createCubeFolder(join(root, "cubes"), "Second");
    await server.open(second.dir);
    const stale = await dispatch(
      server.routes,
      new Request("http://test/api/config", {
        method: "PUT",
        headers: { "X-Cube-Id": first.config.id },
        body: JSON.stringify({ ...first.config, size: { min: 1, max: 2 } }),
      }),
    );
    expect(stale?.status).toBe(409);
    expect(await readConfig(first.paths)).toEqual(first.config);
    expect(await readConfig(second.paths)).toEqual(second.config);
  });

  it("knows a cube's new name after Settings renames it", async () => {
    const { config: saved } = server.cube();
    const response = await dispatch(
      server.routes,
      new Request("http://test/api/config", {
        method: "PUT",
        body: JSON.stringify({ ...saved, name: "Renamed" }),
      }),
    );
    expect(response?.status).toBe(200);
    expect(server.cube().config.name).toBe("Renamed");
  });
});
