import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ElectronApplication, Page } from "@playwright/test";
import { _electron as electron, test as base, expect } from "@playwright/test";

const DESKTOP_ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE = fileURLToPath(new URL("../../web/e2e/fixture", import.meta.url));
const CACHE_DIR = fileURLToPath(new URL("../../../.cache", import.meta.url));

interface Desktop {
  app: ElectronApplication;
  page: Page;
  cardsDir: string;
}

const test = base.extend<{ desktop: Desktop }>({
  // eslint-disable-next-line no-empty-pattern
  desktop: async ({}, provide) => {
    const root = await mkdtemp(join(tmpdir(), "desktop-"));
    await cp(FIXTURE, root, { recursive: true });
    const app = await electron.launch({
      args: [DESKTOP_ROOT],
      env: {
        ...process.env,
        CUBE_REPO_ROOT: root,
        CUBE_USER_DATA: join(root, "user-data"),
        CUBE_CACHE_DIR: CACHE_DIR,
      },
    });
    const page = await app.firstWindow();
    await provide({ app, page, cardsDir: join(root, "cube", "cards") });
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
  expect(page.url()).toBe("app://bundle/");
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

test("notes typed right before a reload are saved", async ({ desktop }) => {
  const { page, cardsDir } = desktop;
  await page.evaluate(() => {
    window.location.hash = "#/card/dream-harvest";
  });
  await page.getByLabel("Notes").fill("typed then reloaded");
  await page.reload();
  await expect.poll(() => notes(cardsDir, "dream-harvest")).toBe("typed then reloaded");
});

test("the renderer is sandboxed and gets only the desktop bridge", async ({ desktop }) => {
  const { page } = desktop;
  const exposed = await page.evaluate(() => ({
    bridge: Object.keys((window as { desktop?: object }).desktop ?? {}),
    require: typeof (window as { require?: unknown }).require,
    process: typeof (window as { process?: unknown }).process,
  }));
  expect(exposed).toEqual({
    bridge: ["onCubeChanged"],
    require: "undefined",
    process: "undefined",
  });
  const csp = await page.evaluate(async () =>
    (await fetch("/")).headers.get("Content-Security-Policy"),
  );
  expect(csp).toContain("default-src 'self'");
  await page.evaluate(() => {
    window.location.href = "https://example.com/";
  });
  await expect.poll(() => page.url()).toBe("app://bundle/");
});
