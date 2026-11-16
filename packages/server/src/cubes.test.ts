import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCubeFolder } from "@repo/cube";
import { beforeEach, describe, expect, it } from "vitest";
import type { CubeHostServer } from "./cubes.ts";
import { createCubeHostServer, startingCube } from "./cubes.ts";
import { RecentCubes, recentCubesFor } from "./recent-cubes.ts";

let root: string;
let host: CubeHostServer;
let recent: RecentCubes;
let firstDir: string;

async function start(openByPath: boolean): Promise<CubeHostServer> {
  return createCubeHostServer({
    cubeDir: firstDir,
    cacheDir: join(root, "cache"),
    imageCacheDir: join(root, "images"),
    home: join(root, "cubes"),
    recent,
    openByPath,
    hosts: [],
  });
}

async function call(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = { "Content-Type": "application/json" },
): Promise<{ status: number; body: unknown }> {
  const response = await host.handle(
    new Request(`http://localhost${path}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body), headers }),
    }),
  );
  if (response === undefined) {
    throw new Error(`${method} ${path} was not handled`);
  }
  return { status: response.status, body: await response.json() };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "cubes-"));
  recent = new RecentCubes(join(root, "user-data"));
  firstDir = (await createCubeFolder(join(root, "cubes"), "First")).dir;
  host = await start(true);
});

describe("cube routes", () => {
  it("lists the open cube as current and recent", async () => {
    const { body } = await call("GET", "/api/cubes");
    expect(body).toMatchObject({
      current: { name: "First", dir: firstDir },
      recent: [{ name: "First" }],
    });
  });

  it("creates a cube with the open cube's format and switches to it", async () => {
    const switched: string[] = [];
    host.library.onSwitch((cube) => switched.push(cube.name));
    const { status, body } = await call("POST", "/api/cubes", { name: "Second" });
    expect(status).toBe(200);
    expect(body).toMatchObject({ name: "Second" });
    expect(host.server.cube().config.name).toBe("Second");
    expect(switched).toEqual(["Second"]);
    const config: unknown = JSON.parse(
      await readFile(join(root, "cubes", "second", "cube.config.json"), "utf8"),
    );
    expect(config).toMatchObject({ format: host.server.cube().config.format });
    const list = await call("GET", "/api/cubes");
    expect(list.body).toMatchObject({ recent: [{ name: "Second" }, { name: "First" }] });
  });

  it("switches only to cubes on the recent list", async () => {
    const other = await createCubeFolder(join(root, "elsewhere"), "Other");
    expect((await call("POST", "/api/cubes/switch", { dir: other.dir })).status).toBe(400);
    await call("POST", "/api/cubes", { name: "Second" });
    const back = await call("POST", "/api/cubes/switch", { dir: firstDir });
    expect(back).toMatchObject({ status: 200, body: { name: "First" } });
  });

  it("opens any cube folder by path when the host allows it", async () => {
    const other = await createCubeFolder(join(root, "elsewhere"), "Other");
    const opened = await call("POST", "/api/cubes/open", { dir: other.dir });
    expect(opened).toMatchObject({ status: 200, body: { name: "Other" } });
    const empty = join(root, "empty");
    await mkdir(empty);
    expect((await call("POST", "/api/cubes/open", { dir: empty })).status).toBe(400);
  });

  it("has no open-by-path route when the host picks folders itself", async () => {
    host = await start(false);
    const other = await createCubeFolder(join(root, "elsewhere"), "Other");
    expect((await call("POST", "/api/cubes/open", { dir: other.dir })).status).toBe(404);
  });

  it("removes other cubes from the list but not the open one", async () => {
    await call("POST", "/api/cubes", { name: "Second" });
    expect((await call("POST", "/api/cubes/remove", { dir: host.server.cube().dir })).status).toBe(
      400,
    );
    const { body } = await call("POST", "/api/cubes/remove", { dir: firstDir });
    expect(body).toMatchObject({ recent: [{ name: "Second" }] });
  });

  it("reports offline status only for known cubes", async () => {
    const status = await call("GET", `/api/cubes/offline?dir=${encodeURIComponent(firstDir)}`);
    expect(status).toMatchObject({ status: 200, body: { cards: 0 } });
    const other = await createCubeFolder(join(root, "elsewhere"), "Other");
    const refused = await call("GET", `/api/cubes/offline?dir=${encodeURIComponent(other.dir)}`);
    expect(refused.status).toBe(400);
  });

  it("leaves other routes to the workbench server", async () => {
    expect(await call("GET", "/api/config")).toMatchObject({ body: { name: "First" } });
  });
});

describe("starting cube", () => {
  it("prefers the most recent cube that opens, then the fallbacks", async () => {
    await call("POST", "/api/cubes", { name: "Second" });
    expect(await startingCube(recent, [])).toBe(join(root, "cubes", "second"));
    const empty = new RecentCubes(join(root, "none"));
    expect(await startingCube(empty, [join(root, "missing"), firstDir])).toBe(firstDir);
    expect(await startingCube(empty, [])).toBeUndefined();
  });
});

describe("recent cubes", () => {
  it("keeps every entry when switches land at once", async () => {
    const refs = ["a", "b", "c", "d", "e"].map((id) => ({ dir: join(root, id), id, name: id }));
    await Promise.all(refs.map((ref) => recent.opened(ref)));
    expect((await recent.load()).cubes.map((cube) => cube.id).sort()).toEqual(
      expect.arrayContaining(["a", "b", "c", "d", "e"]),
    );
  });

  it("keeps a CUBE_DIR run out of the user's list", async () => {
    const userData = join(root, "real-user-data");
    await recentCubesFor(userData, true).opened({ dir: join(root, "tmp"), id: "t", name: "Temp" });
    expect((await new RecentCubes(userData).load()).cubes).toEqual([]);
    await recentCubesFor(userData, false).opened({ dir: firstDir, id: "f", name: "First" });
    expect((await new RecentCubes(userData).load()).cubes).toHaveLength(1);
  });
});
