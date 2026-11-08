import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect } from "@playwright/test";
import type { CardEntry } from "@repo/cube/browser";
import { cardEntrySchema } from "@repo/cube/browser";
import { createServer } from "vite";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

interface Workbench {
  url: string;
  cardsDir: string;
}

const test = base.extend<object, { workbench: Workbench }>({
  workbench: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const root = await mkdtemp(join(tmpdir(), "workbench-"));
      await cp(join(REPO_ROOT, "cube"), join(root, "cube"), { recursive: true });
      await cp(join(REPO_ROOT, "cube.config.json"), join(root, "cube.config.json"));
      process.env["CUBE_REPO_ROOT"] = root;
      const server = await createServer({
        root: WEB_ROOT,
        configLoader: "runner",
        logLevel: "warn",
        server: { port: 0, host: "127.0.0.1" },
      });
      await server.listen();
      const url = server.resolvedUrls?.local[0];
      if (url === undefined) {
        throw new Error("workbench server has no URL");
      }
      await use({ url, cardsDir: join(root, "cube", "cards") });
      await server.close();
      await rm(root, { recursive: true, force: true });
    },
    { scope: "worker" },
  ],
});

test.describe.configure({ mode: "serial" });

async function readEntry(cardsDir: string, slug: string): Promise<CardEntry> {
  return cardEntrySchema.parse(JSON.parse(await readFile(join(cardsDir, `${slug}.json`), "utf8")));
}

test("workbench shows live data from cube/cards", async ({ page, workbench }) => {
  const files = (await readdir(workbench.cardsDir)).filter((file) => file.endsWith(".json"));
  await page.goto(workbench.url);
  await expect(page.getByTestId("cube-label")).toContainText("live");
  await expect(page.locator(".grid img")).toHaveCount(files.length);
  await expect(page.getByLabel("Your name")).toHaveCount(0);
});

test("an edit on disk shows up without a reload", async ({ page, workbench }) => {
  await page.goto(`${workbench.url}#/card/abrade`);
  await expect(page.getByTestId("card-status")).toHaveText("draft");

  const entry = await readEntry(workbench.cardsDir, "abrade");
  await writeFile(
    join(workbench.cardsDir, "abrade.json"),
    `${JSON.stringify({ ...entry, status: "cut", notes: "edited on disk" }, null, 2)}\n`,
  );
  await expect(page.getByTestId("card-status")).toHaveText("cut");
  await expect(page.getByTestId("card-notes")).toHaveText("edited on disk");

  await page.getByRole("link", { name: "← all cards" }).click();
  await expect(page.locator('[data-group="cut"] img[alt="Abrade"]')).toBeVisible();
  await expect(page.locator('[data-group="draft"] img[alt="Abrade"]')).toHaveCount(0);
});

test("the write API validates and lands edits on disk", async ({ page, workbench }) => {
  await page.goto(`${workbench.url}#/card/bite-down`);
  const entry = await readEntry(workbench.cardsDir, "bite-down");

  const rejected = await page.request.put(`${workbench.url}api/cards/bite-down`, {
    data: { ...entry, status: "maybe" },
  });
  expect(rejected.status()).toBe(400);
  expect(await readEntry(workbench.cardsDir, "bite-down")).toEqual(entry);

  const renamed = await page.request.put(`${workbench.url}api/cards/bite-down`, {
    data: { ...entry, name: "Bite Up" },
  });
  expect(renamed.status()).toBe(400);

  const edited = { ...entry, notes: "saved through the API", tags: ["removal"] };
  const saved = await page.request.put(`${workbench.url}api/cards/bite-down`, { data: edited });
  expect(saved.status()).toBe(200);
  expect(await readEntry(workbench.cardsDir, "bite-down")).toEqual(edited);
  await expect(page.getByTestId("card-notes")).toHaveText("saved through the API");
});
