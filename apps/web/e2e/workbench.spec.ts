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

const TEST_VOCABULARY = [
  { id: "removal", label: "Removal", kind: "group" },
  { id: "tempo", label: "Tempo", kind: "archetype" },
  { id: "card-draw", label: "Card draw", kind: "group" },
  { id: "blue", label: "Blue", kind: "group" },
  { id: "cantrip", label: "Cantrip", kind: "group" },
];

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
      await writeFile(
        join(root, "cube", "tags.json"),
        `${JSON.stringify({ tags: TEST_VOCABULARY }, null, 2)}\n`,
      );
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
  const pressed = (name: string) =>
    expect(page.getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true");
  await pressed("draft");

  const entry = await readEntry(workbench.cardsDir, "abrade");
  await writeFile(
    join(workbench.cardsDir, "abrade.json"),
    `${JSON.stringify({ ...entry, status: "cut", notes: "edited on disk" }, null, 2)}\n`,
  );
  await pressed("cut");
  await expect(page.getByLabel("Notes")).toHaveValue("edited on disk");

  await page.getByRole("link", { name: "← all cards" }).click();
  await expect(page.locator('[data-group="cut"] img[alt="Abrade"]')).toBeVisible();
  await expect(page.locator('[data-group="draft"] img[alt="Abrade"]')).toHaveCount(0);
});

test("the write API validates and lands edits on disk", async ({ page, workbench }) => {
  await page.goto(`${workbench.url}#/card/bite-down`);
  const entry = await readEntry(workbench.cardsDir, "bite-down");
  const url = `${workbench.url}api/cards/bite-down`;

  for (const data of [{ status: "maybe" }, { name: "Bite Up" }, { section: "elves" }]) {
    const rejected = await page.request.patch(url, { data });
    expect(rejected.status()).toBe(400);
  }
  expect(await readEntry(workbench.cardsDir, "bite-down")).toEqual(entry);

  const saved = await page.request.patch(url, {
    data: { notes: "saved through the API", tags: ["removal"] },
  });
  expect(saved.status()).toBe(200);
  expect(await readEntry(workbench.cardsDir, "bite-down")).toEqual({
    ...entry,
    notes: "saved through the API",
    tags: ["removal"],
  });
  await expect(page.getByLabel("Notes")).toHaveValue("saved through the API");
});

test("parallel writes leave a valid card file", async ({ page, workbench }) => {
  const notes = Array.from({ length: 12 }, (_, index) => "x".repeat(index % 2 ? 2000 : 1));
  const responses = await Promise.all(
    notes.map((note) =>
      page.request.patch(`${workbench.url}api/cards/abrade`, { data: { notes: note } }),
    ),
  );
  expect(responses.map((response) => response.status())).toEqual(notes.map(() => 200));
  const final = await readEntry(workbench.cardsDir, "abrade");
  expect(notes).toContain(final.notes);
  const leftovers = (await readdir(workbench.cardsDir)).filter((file) => file.endsWith(".tmp"));
  expect(leftovers).toEqual([]);
});

test("editing status, section, tags and notes auto-saves to disk", async ({ page, workbench }) => {
  const slug = "banishing-light";
  const entry = await readEntry(workbench.cardsDir, slug);
  const disk = (): Promise<CardEntry> => readEntry(workbench.cardsDir, slug);
  await page.goto(`${workbench.url}#/card/${slug}`);

  await page.getByRole("button", { name: "prospect", exact: true }).click();
  await expect.poll(async () => (await disk()).status).toBe("prospect");

  await page.getByLabel("Section").selectOption("pirates");
  await expect.poll(async () => (await disk()).section).toBe("pirates");

  await page.getByLabel("New tag").fill("removal");
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect.poll(async () => (await disk()).tags).toEqual([...entry.tags, "removal"]);

  await page.getByLabel("Notes").fill("Clean answer, keep.");
  await expect.poll(async () => (await disk()).notes).toBe("Clean answer, keep.");
  await expect(page.getByTestId("save-state")).toHaveText("all changes saved");

  await page.reload();
  await expect(page.getByRole("button", { name: "prospect", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Notes")).toHaveValue("Clean answer, keep.");
  await expect(page.getByRole("listitem").filter({ hasText: "removal" })).toBeVisible();

  await page.getByRole("button", { name: "Remove tag removal" }).click();
  await expect.poll(async () => (await disk()).tags).toEqual(entry.tags);
  await page.getByLabel("Section").selectOption("");
  await expect.poll(async () => (await disk()).section).toBeUndefined();
});

test("undo reverts the last save on disk", async ({ page, workbench }) => {
  const slug = "deduce";
  const entry = await readEntry(workbench.cardsDir, slug);
  const disk = (): Promise<CardEntry> => readEntry(workbench.cardsDir, slug);
  await page.goto(`${workbench.url}#/card/${slug}`);

  await page.getByRole("button", { name: "cut", exact: true }).click();
  await expect.poll(async () => (await disk()).status).toBe("cut");
  await expect(page.getByRole("status")).toContainText("Saved status");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await disk()).status).toBe(entry.status);
  await expect(page.getByRole("button", { name: entry.status, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("status")).toContainText("Undid status");

  await page.getByLabel("Notes").fill("first thought");
  await expect.poll(async () => (await disk()).notes).toBe("first thought");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await disk()).notes).toBe(entry.notes);
});

test("rapid edits all land and the page settles on them", async ({ page, workbench }) => {
  const slug = "chart-a-course";
  const disk = (): Promise<CardEntry> => readEntry(workbench.cardsDir, slug);
  await page.goto(`${workbench.url}#/card/${slug}`);
  await expect(page.getByLabel("Notes")).toBeVisible();

  for (const tag of ["tempo", "card-draw", "blue"]) {
    await page.getByLabel("New tag").fill(tag);
    await page.getByLabel("New tag").press("Enter");
  }
  await page.getByRole("button", { name: "cut", exact: true }).click();
  await page.getByRole("button", { name: "prospect", exact: true }).click();

  await expect.poll(async () => (await disk()).tags).toEqual(["tempo", "card-draw", "blue"]);
  await expect.poll(async () => (await disk()).status).toBe("prospect");
  await expect(page.getByTestId("save-state")).toHaveText("all changes saved");
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "prospect", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".chip")).toHaveText(["tempo×", "card-draw×", "blue×"]);

  await page.getByRole("button", { name: "Remove tag tempo" }).click();
  await page.getByLabel("New tag").fill("cantrip");
  await page.getByLabel("New tag").press("Enter");
  await page.getByRole("button", { name: "Remove tag blue" }).click();
  await expect.poll(async () => (await disk()).tags).toEqual(["card-draw", "cantrip"]);
  await expect(page.locator(".chip")).toHaveText(["card-draw×", "cantrip×"]);
});

test("leaving the card right after typing keeps every edit", async ({ page, workbench }) => {
  const slug = "essence-scatter";
  const disk = (): Promise<CardEntry> => readEntry(workbench.cardsDir, slug);
  await page.goto(`${workbench.url}#/card/${slug}`);
  await page.getByRole("button", { name: "cut", exact: true }).click();
  await page.getByLabel("Notes").fill("left in a hurry");
  await page.getByRole("link", { name: "← all cards" }).click();
  await expect(page.locator('[data-group="cut"] img[alt="Essence Scatter"]')).toBeVisible();
  await expect.poll(async () => (await disk()).notes).toBe("left in a hurry");
  expect((await disk()).status).toBe("cut");
  await page.locator('img[alt="Essence Scatter"]').click();
  await expect(page.getByLabel("Notes")).toHaveValue("left in a hurry");
});

test("notes typed right before a reload are saved", async ({ page, workbench }) => {
  const slug = "dream-harvest";
  await page.goto(`${workbench.url}#/card/${slug}`);
  await page.getByLabel("Notes").fill("typed then reloaded");
  await page.reload();
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, slug)).notes)
    .toBe("typed then reloaded");
});
