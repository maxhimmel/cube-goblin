import { cp, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ElectronApplication, Locator, Page } from "@playwright/test";
import { _electron as electron, test as base, expect } from "@playwright/test";

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

async function notes(cardsDir: string, slug: string): Promise<unknown> {
  const entry: unknown = JSON.parse(await readFile(join(cardsDir, `${slug}.json`), "utf8"));
  return typeof entry === "object" && entry !== null && "notes" in entry ? entry.notes : undefined;
}

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
    bridge: ["onCubeChanged", "cubes"],
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

async function switcher(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Switch cube" }).click();
  const menu = page.getByRole("group", { name: "Cubes" });
  await expect(menu).toBeVisible();
  return menu;
}

async function settingsTab(page: Page): Promise<string | null> {
  await page.getByRole("button", { name: "Settings" }).click();
  const selected = page
    .getByRole("dialog", { name: "Settings" })
    .getByRole("tab", { selected: true });
  const name = await selected.textContent();
  await page
    .getByRole("dialog", { name: "Settings" })
    .getByRole("button", { name: "Close" })
    .click();
  return name;
}

test("two cubes keep their own cards, history, and view choices, and the app reopens the last", async ({
  desktop,
}) => {
  let page = desktop.page;
  const brand = (): Locator => page.locator(".brand");
  const tiles = (): Locator => page.locator(".lab-image img");
  await expect(brand()).toHaveText("Max's Cube");
  await page.evaluate(() => {
    window.location.hash = "#/card/abrade";
  });
  await page.getByLabel("Notes").fill("only in the first cube");
  await page.getByLabel("Notes").blur();
  await expect.poll(() => notes(desktop.cardsDir, "abrade")).toBe("only in the first cube");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("tab", { name: "Forge" }).click();
  await page
    .getByRole("dialog", { name: "Settings" })
    .getByRole("button", { name: "Close" })
    .click();
  await page.evaluate(() => {
    window.location.hash = "#/cards";
  });
  const firstCount = await tiles().count();
  expect(firstCount).toBeGreaterThan(0);

  const menu = await switcher(page);
  await menu.getByLabel("New cube name").fill("Second Cube");
  await menu.getByRole("button", { name: "New cube" }).click();
  await expect(brand()).toHaveText("Second Cube");
  const secondDir = join(desktop.cubesHome, "second-cube");
  const secondConfig: unknown = JSON.parse(
    await readFile(join(secondDir, "cube.config.json"), "utf8"),
  );
  expect(secondConfig).toMatchObject({ name: "Second Cube", format: "winston" });
  await expect(tiles()).toHaveCount(0);
  expect(await settingsTab(page)).toBe("Cube");
  await page.evaluate(() => {
    window.location.hash = "#/history";
  });
  await expect(page.getByTestId("log-entry")).toHaveCount(0);

  await (await switcher(page)).getByRole("button", { name: "Max's Cube", exact: true }).click();
  await expect(brand()).toHaveText("Max's Cube");
  await expect(page.getByTestId("log-entry").first()).toBeVisible();
  expect(await settingsTab(page)).toBe("Forge");
  await page.evaluate(() => {
    window.location.hash = "#/cards";
  });
  await expect(tiles()).toHaveCount(firstCount);

  await (await switcher(page)).getByRole("button", { name: "Second Cube", exact: true }).click();
  await expect(brand()).toHaveText("Second Cube");
  page = await desktop.relaunch();
  await expect(brand()).toHaveText("Second Cube");

  const recents = await switcher(page);
  await recents.getByRole("button", { name: "Remove Max's Cube from the list" }).click();
  await expect(recents.getByRole("button", { name: "Max's Cube", exact: true })).toHaveCount(0);
  expect(await notes(desktop.cardsDir, "abrade")).toBe("only in the first cube");
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
  const menu = await switcher(page);
  const current = menu.locator(".cube-recent[data-current='true']");
  const make = current.getByRole("button", { name: "Make available offline" });
  await expect(current.getByText(/Available offline · |cards saved offline · /u)).toBeVisible();
  if (await make.isVisible()) {
    await make.click();
  }
  await expect(current.getByText(/^Available offline · /u)).toBeVisible({ timeout: 280_000 });
  await page.keyboard.press("Escape");

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
  const { page } = desktop;
  await page.getByRole("button", { name: "Import and export" }).click();
  const panel = page.getByRole("dialog", { name: "Import and export" });
  await panel.getByRole("tab", { name: "Import" }).click();
  await panel.getByLabel("List to import").fill("Deck\n1 Lightning Bolt\n\nSideboard\n1 Shock\n");
  await panel.getByRole("button", { name: "Preview" }).click();
  await expect(panel.getByText("Adds 1 card: 1 draft, 0 prospect, 0 cut.")).toBeVisible({
    timeout: 30000,
  });
  await panel.getByLabel("A new cube").check();
  await expect(panel.getByText("Adds 2 cards: 1 draft, 1 prospect, 0 cut.")).toBeVisible({
    timeout: 30000,
  });
  await panel.getByLabel("New cube name").fill("Bolts");
  await panel.getByRole("button", { name: "Import 2 cards" }).click();

  await expect(page.getByRole("button", { name: "Import and export" })).toHaveAttribute(
    "aria-expanded",
    "false",
    { timeout: 30000 },
  );
  await expect(page).toHaveTitle("Bolts");
  const cards = join(desktop.cubesHome, "bolts", "cards");
  const bolt: unknown = JSON.parse(await readFile(join(cards, "lightning-bolt.json"), "utf8"));
  const shock: unknown = JSON.parse(await readFile(join(cards, "shock.json"), "utf8"));
  expect(bolt).toMatchObject({ status: "draft" });
  expect(shock).toMatchObject({ status: "prospect" });
  expect(await notes(desktop.cardsDir, "shock")).toBe("");
});
