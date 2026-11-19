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
  const reloaded = page.waitForEvent("load");
  await menu.getByRole("button", { name: "Open folder", exact: true }).click();
  await reloaded;
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

async function addRival(web: WebHost): Promise<void> {
  const { page } = web;
  const rivalDir = join(web.root, "rival");
  await cp(join(FIXTURE, "rival"), rivalDir, { recursive: true });
  const menu = await switcher(page);
  await menu.getByLabel("Cube folder path").fill(rivalDir);
  await menu.getByRole("button", { name: "Open folder", exact: true }).click();
  await expect(page.locator(".brand")).toHaveText("Rival Cube");
  await (await switcher(page)).getByRole("button", { name: "Max's Cube", exact: true }).click();
  await expect(page.locator(".brand")).toHaveText("Max's Cube");
}

test("Forge compares the open cube with another cube on the recent list", async ({ web }) => {
  const { page } = web;
  await addRival(web);

  await page.getByRole("button", { name: "Compare", exact: true }).click();
  const compare = page.getByRole("group", { name: "Compare with another cube" });
  await compare.getByLabel("Rival Cube").check();
  await page.mouse.move(1, 1);
  const creatures = page.getByRole("listitem", { name: /^Creatures:/u });
  await expect(creatures).toHaveAttribute("aria-label", "Creatures: 15, Rival Cube 12 scaled");
  await compare.getByRole("button", { name: "Counts" }).click();
  await expect(creatures).toHaveAttribute("aria-label", "Creatures: 15, Rival Cube 5");
  await page.keyboard.press("Escape");
  await page.getByLabel("Scope of Summary").selectOption("all");
  await page.mouse.move(1, 1);
  await expect(creatures).toHaveAttribute("aria-label", /, Rival Cube 6$/u);

  const tags = page.getByRole("region", { name: "Tags", exact: true });
  await expect(tags.getByRole("listitem", { name: /^Removal:/u })).toHaveAttribute(
    "aria-label",
    /Rival Cube 5$/u,
  );
  await expect(tags.getByText("Only in Rival Cube")).toBeVisible();
  const shared = page.getByRole("region", { name: "Shared cards", exact: true });
  await expect(shared.getByText("In both")).toContainText("2");
  await expect(shared.getByText("Only in Rival Cube")).toContainText("10");

  await page.reload();
  await expect(page.getByRole("button", { name: "vs Rival Cube" })).toBeVisible();
  await page.getByRole("button", { name: "vs Rival Cube" }).click();
  await page.getByRole("group", { name: "Compare with another cube" }).getByLabel("None").check();
  await expect(page.getByRole("region", { name: "Shared cards", exact: true })).toHaveCount(0);
  await expect(creatures).toHaveAttribute("aria-label", /^Creatures: \d+$/u);
});

test("the Cubes view shows one radar, a section strip, and an inspector that keeps pins", async ({
  web,
}) => {
  const { page } = web;
  await addRival(web);
  await page.getByRole("link", { name: "Cubes" }).click();
  await expect(page.getByRole("img", { name: /^Color: Max's Cube, Rival Cube/u })).toBeVisible();

  const strip = page.getByRole("navigation", { name: "Sections" });
  await strip.getByRole("button", { name: /^Card types/u }).click();
  const stage = page.getByRole("region", { name: "Card types" });
  await expect(stage.getByRole("img", { name: /^Card types:/u })).toBeVisible();

  const spokes = page.getByRole("list", { name: "Card types spokes" });
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await spokes.getByRole("button", { name: /Instant$/u }).hover();
  await expect(inspector.getByLabel("Inspecting Instant")).toContainText("Rival Cube42%");
  await expect(inspector.locator(".cubes-caption")).toHaveText(/^Click to (un)?pin/u);
  const plot = await page.locator(".cubes-hero-plot").boundingBox();
  if (plot) {
    await page.mouse.click(plot.x + 12, plot.y + plot.height - 12);
  }
  await expect(inspector.locator(".cubes-caption")).toHaveText("Biggest gap in Card types");

  const gaps = inspector.getByRole("list", { name: "Biggest gaps" }).getByRole("listitem");
  await expect(gaps.first()).toContainText(/[+−]\d/u);
  await gaps.first().locator(".cubes-item").hover();
  await expect(page.locator(".cubes-tile[data-holds]").first()).toBeVisible();
  await inspector.getByRole("tab", { name: /Pinned/u }).click();
  const pinned = inspector.getByRole("list", { name: "Pinned spokes" }).getByRole("listitem");
  const before = await pinned.count();
  await spokes.getByRole("button", { name: /^Pin /u }).first().click();
  await expect(pinned).toHaveCount(before + 1);
  await inspector
    .getByRole("button", { name: /^Unpin /u })
    .last()
    .click();
  await expect(pinned).toHaveCount(before);

  await page.getByRole("checkbox", { name: /Rival Cube/u }).hover();
  await expect(page.locator(".cubes")).toHaveAttribute("data-hot", "1");
  await page.mouse.move(1, 1);
  await expect(page.locator(".cubes")).not.toHaveAttribute("data-hot");

  await stage.getByRole("button", { name: "Table" }).click();
  const creatures = stage.getByRole("row", { name: /Creature/u });
  await expect(creatures.getByRole("cell")).toHaveText([/^52%\+5$/u, /^42%−5$/u, "47%"]);
  await page
    .getByRole("group", { name: "Numbers" })
    .getByRole("button", { name: "Counts" })
    .click();
  await expect(creatures.getByRole("cell")).toHaveText([/^15/u, /^5/u, "10.0"]);

  await strip.getByRole("button", { name: /^Custom/u }).click();
  await expect(page.getByRole("region", { name: "Custom" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Custom" })).toBeVisible();
  await expect(pinned).toHaveCount(before);

  await page.getByRole("checkbox", { name: /Rival Cube/u }).uncheck();
  await expect(page.getByText("Pick two or more cubes.")).toBeVisible();
});
