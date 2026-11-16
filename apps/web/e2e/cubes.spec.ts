import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";
import type { ViteDevServer } from "vite";
import { createServer } from "vite";
import type { HostUnderTest } from "./flows/cubes.ts";
import { importIntoNewCube, makeAvailableOffline, switcher, twoCubes } from "./flows/cubes.ts";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE = fileURLToPath(new URL("fixture", import.meta.url));

interface WebHost extends HostUnderTest {
  root: string;
}

async function serve(
  root: string,
  cubeDir: string | undefined,
  index: number,
): Promise<ViteDevServer> {
  if (cubeDir === undefined) {
    delete process.env["CUBE_DIR"];
  } else {
    process.env["CUBE_DIR"] = cubeDir;
  }
  process.env["CUBE_USER_DATA"] = join(root, "user-data");
  process.env["CUBES_HOME"] = join(root, "cubes");
  const server = await createServer({
    root: WEB_ROOT,
    configLoader: "runner",
    cacheDir: join(WEB_ROOT, "node_modules", ".vite-e2e-cubes", String(index)),
    logLevel: "warn",
    server: { port: 0, host: "127.0.0.1" },
  });
  await server.listen();
  return server;
}

async function visit(page: Page, server: ViteDevServer): Promise<Page> {
  const url = server.resolvedUrls?.local[0];
  if (url === undefined) {
    throw new Error("workbench server has no URL");
  }
  await page.goto(url);
  return page;
}

const test = base.extend<{ web: WebHost }>({
  web: async ({ page }, provide, testInfo) => {
    const root = await mkdtemp(join(tmpdir(), "web-cubes-"));
    const cubeDir = join(root, "cube");
    await cp(join(FIXTURE, "cube"), cubeDir, { recursive: true });
    let server = await serve(root, cubeDir, testInfo.parallelIndex);
    await visit(page, server);
    await provide({
      page,
      root,
      cardsDir: join(cubeDir, "cards"),
      cubesHome: join(root, "cubes"),
      relaunch: async () => {
        await server.close();
        server = await serve(root, undefined, testInfo.parallelIndex);
        return visit(page, server);
      },
    });
    await server.close();
    delete process.env["CUBE_DIR"];
    delete process.env["CUBE_USER_DATA"];
    delete process.env["CUBES_HOME"];
    await rm(root, { recursive: true, force: true });
  },
});

test("two cubes keep their own cards, history, and view choices, and the server reopens the last", async ({
  web,
}) => {
  await twoCubes(web);
});

test("a cube folder opens by its path", async ({ web }) => {
  const { page } = web;
  const otherDir = join(web.root, "elsewhere", "other");
  await cp(join(FIXTURE, "cube"), otherDir, { recursive: true });
  const menu = await switcher(page);
  await expect(menu.getByRole("button", { name: "Open folder…" })).toHaveCount(0);
  await menu.getByLabel("Cube folder path").fill(join(web.root, "missing"));
  await menu.getByRole("button", { name: "Open folder", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "holds no cube" })).toBeVisible();
  await menu.getByLabel("Cube folder path").fill(otherDir);
  await menu.getByRole("button", { name: "Open folder", exact: true }).click();
  await expect(page.locator(".brand")).toHaveText("Max's Cube");
  const recents = await switcher(page);
  await expect(recents.locator(".cube-open")).toHaveCount(2);
  await expect(recents.locator(".cube-open[aria-current='true']")).toHaveAttribute(
    "title",
    otherDir,
  );
});

test("a cube can be made available offline from the cube menu", async ({ web }) => {
  test.setTimeout(300_000);
  await makeAvailableOffline(web.page);
});

test("an import can land in a new cube", async ({ web }) => {
  await importIntoNewCube(web);
});
