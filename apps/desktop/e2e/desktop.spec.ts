import { cp, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ElectronApplication, Page } from "@playwright/test";
import { _electron as electron, test as base, expect } from "@playwright/test";
import {
  importIntoNewCube,
  makeAvailableOffline,
  notes,
  twoCubes,
} from "../../web/e2e/flows/cubes.ts";

const DESKTOP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE = fileURLToPath(new URL("../../web/e2e/fixture", import.meta.url));
const CACHE_DIR = fileURLToPath(new URL("../../../.cache", import.meta.url));

interface Desktop {
  app: ElectronApplication;
  page: Page;
  root: string;
  cubeDir: string;
  cardsDir: string;
  cubesHome: string;
  relaunch: (options?: { cubeDir?: string }) => Promise<Page>;
}

function launch(root: string, cubeDir: string | undefined): Promise<ElectronApplication> {
  const env = { ...process.env };
  delete env["CUBE_DIR"];
  return electron.launch({
    args: [DESKTOP_ROOT],
    env: {
      ...env,
      ...(cubeDir === undefined ? {} : { CUBE_DIR: cubeDir }),
      CUBE_USER_DATA: join(root, "user-data"),
      CUBES_HOME: join(root, "cubes"),
      CUBE_CACHE_DIR: CACHE_DIR,
      CUBE_DESKTOP_HIDDEN: "1",
    },
  });
}

const test = base.extend<{ desktop: Desktop }>({
  // eslint-disable-next-line no-empty-pattern
  desktop: async ({}, provide) => {
    const root = await mkdtemp(join(tmpdir(), "desktop-"));
    const cubeDir = join(root, "cube");
    await cp(join(FIXTURE, "cube"), cubeDir, { recursive: true });
    let app = await launch(root, cubeDir);
    const desktop: Desktop = {
      app,
      page: await app.firstWindow(),
      root,
      cubeDir,
      cardsDir: join(cubeDir, "cards"),
      cubesHome: join(root, "cubes"),
      relaunch: async (options = {}) => {
        await app.close();
        app = await launch(root, options.cubeDir);
        desktop.app = app;
        desktop.page = await app.firstWindow();
        return desktop.page;
      },
    };
    await provide(desktop);
    await app.close();
    await rm(root, { recursive: true, force: true });
  },
});

test("the app serves the workbench and its card images over app://", async ({ desktop }) => {
  const { page } = desktop;
  await page.waitForURL("app://bundle/");
  await page.evaluate(() => {
    window.location.hash = "#/cards";
  });
  const image = page.locator(".lab-image img").first();
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);
  expect(await image.getAttribute("src")).toMatch(/^\/api\/image\?u=/u);
});

test("an edit on disk shows up without a reload", async ({ desktop }) => {
  const { page, cardsDir } = desktop;
  await page.evaluate(() => {
    window.location.hash = "#/card/abrade";
  });
  await expect(page.getByLabel("Notes")).toBeVisible();
  const file = join(cardsDir, "abrade.json");
  const entry: unknown = JSON.parse(await readFile(file, "utf8"));
  await writeFile(
    file,
    `${JSON.stringify({ ...(entry as object), notes: "edited on disk" }, null, 2)}\n`,
  );
  await expect(page.getByLabel("Notes")).toHaveValue("edited on disk");
});

test("config saved by rename keeps updating the app", async ({ desktop }) => {
  const { page, cubeDir } = desktop;
  const file = join(cubeDir, "cube.config.json");
  const replace = async (max: number): Promise<void> => {
    const config = {
      id: "fixture-cube",
      name: "Max's Cube",
      format: "winston",
      size: { min: 90, max },
    };
    await writeFile(`${file}.tmp`, `${JSON.stringify(config, null, 2)}\n`);
    await rename(`${file}.tmp`, file);
  };
  await expect(page.getByText("target 90–90")).toBeVisible();
  await replace(95);
  await expect(page.getByText("target 90–95")).toBeVisible();
  await replace(99);
  await expect(page.getByText("target 90–99")).toBeVisible();
});

test("notes typed right before a reload are saved", async ({ desktop }) => {
  const { page, cardsDir } = desktop;
  await page.evaluate(() => {
    window.location.hash = "#/card/dream-harvest";
  });
  await page.getByLabel("Notes").fill("typed then reloaded");
  await page.reload();
  await expect.poll(() => notes(cardsDir, "dream-harvest")).toBe("typed then reloaded");
});

test("test runs never show a window or take focus", async ({ desktop }) => {
  await desktop.page.waitForURL("app://bundle/");
  const windows = await desktop.app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((window) => ({
      visible: window.isVisible(),
      focused: window.isFocused(),
    })),
  );
  expect(windows).toEqual([{ visible: false, focused: false }]);
});

test("the renderer is sandboxed and gets only the desktop bridge", async ({ desktop }) => {
  const { page } = desktop;
  const exposed = await page.evaluate(() => ({
    bridge: Object.keys((window as { desktop?: object }).desktop ?? {}),
    require: typeof (window as { require?: unknown }).require,
    process: typeof (window as { process?: unknown }).process,
  }));
  expect(exposed).toEqual({
    bridge: ["onCubeChanged", "openFolder"],
    require: "undefined",
    process: "undefined",
  });
  const csp = await page.evaluate(async () =>
    (await fetch("/")).headers.get("Content-Security-Policy"),
  );
  expect(csp).toContain("default-src 'self'");
  await page.evaluate(() => {
    (window as { stayed?: boolean }).stayed = true;
    window.location.href = "https://example.com/";
  });
  await page.waitForTimeout(1000);
  expect(page.url()).toBe("app://bundle/");
  expect(await page.evaluate(() => (window as { stayed?: boolean }).stayed)).toBe(true);
});

test("two cubes keep their own cards, history, and view choices, and the app reopens the last", async ({
  desktop,
}) => {
  await twoCubes({ ...desktop, relaunch: () => desktop.relaunch() });
});

async function imagesLoad(page: Page, selector: string): Promise<void> {
  const images = page.locator(selector);
  await expect(images.first()).toBeVisible();
  const count = Math.min(await images.count(), 12);
  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0);
  }
}

test("a cube made available offline loads every view and saves edits with Scryfall blocked", async ({
  desktop,
}) => {
  test.setTimeout(300_000);
  const { page, app, cardsDir } = desktop;
  await page.waitForURL("app://bundle/");
  await makeAvailableOffline(page);

  await app.evaluate(() => {
    const network = (globalThis as { cubeTestNetwork?: { cut: boolean } }).cubeTestNetwork;
    if (!network) {
      throw new Error("The hidden test launch has no network switch");
    }
    network.cut = true;
  });
  await page.reload();

  await page.evaluate(() => {
    window.location.hash = "#/";
  });
  await page.getByRole("button", { name: "Images", exact: true }).click();
  await imagesLoad(page, ".lab-image img");
  for (const view of ["Tags", "Insights", "History"]) {
    await page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: view }).click();
    await expect(page.getByRole("heading", { name: view, level: 1 })).toBeVisible();
    await expect(page.locator("main .error")).toHaveCount(0);
  }
  await page.evaluate(() => {
    window.location.hash = "#/card/abrade";
  });
  await imagesLoad(page, ".pane img");
  await page.getByLabel("Notes").fill("written offline");
  await page.getByLabel("Notes").blur();
  await expect.poll(() => notes(cardsDir, "abrade")).toBe("written offline");

  await page.evaluate(() => {
    window.location.hash = "#/?add=true";
  });
  await page.getByRole("searchbox", { name: "Search Scryfall" }).fill("lightning bolt");
  await expect(page.getByRole("status").filter({ hasText: "Offline" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search Scryfall" })).toBeDisabled();
});

test("printing thumbnails load through the app", async ({ desktop }) => {
  const { page } = desktop;
  await page.waitForURL("app://bundle/");
  await page.evaluate(() => {
    window.location.hash = "#/card/shock";
  });
  await page.getByRole("button", { name: "Change printing…" }).click();
  const browser = page.getByRole("dialog", { name: "Printings of Shock" });
  const thumb = browser.locator(".printing:not(.printing-default) img").first();
  await expect(thumb).toBeVisible({ timeout: 20_000 });
  expect(await thumb.getAttribute("src")).toMatch(/^\/api\/image\?u=/u);
  await expect
    .poll(() => thumb.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);
});

test("an import can land in a new cube", async ({ desktop }) => {
  await importIntoNewCube(desktop);
});

test("the import helper copies its AI prompt to the clipboard", async ({ desktop }) => {
  const { page, app } = desktop;
  const saved = await app.evaluate(({ clipboard }) => clipboard.readText());
  try {
    await page.getByRole("button", { name: "Import and export" }).click();
    const panel = page.getByRole("dialog", { name: "Import and export" });
    await panel.getByRole("tab", { name: "Import" }).click();
    await panel.getByRole("button", { name: "Copy AI prompt" }).click();
    await expect(panel.getByRole("button", { name: "Copied ✓" })).toBeVisible();
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(copied).toContain("Convert my Magic: The Gathering cube list");
  } finally {
    await app.evaluate(({ clipboard }, text) => {
      void clipboard.writeText(text);
    }, saved);
  }
});
