import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Locator, Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";
import type { CardEntry, LogEntry } from "@repo/cube/browser";
import { cardEntrySchema, logEntrySchema, parseMessage } from "@repo/cube/browser";
import { foldCanceled, foldedIds } from "../src/log/fold.ts";
import { createServer } from "vite";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE = fileURLToPath(new URL("fixture", import.meta.url));

interface Workbench {
  url: string;
  root: string;
  cardsDir: string;
}

async function resetCube(root: string): Promise<void> {
  await rm(join(root, "cube"), { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  await cp(join(FIXTURE, "cube"), join(root, "cube"), { recursive: true });
  await cp(join(FIXTURE, "cube.config.json"), join(root, "cube.config.json"));
}

const test = base.extend<{ freshCube: undefined }, { workbench: Workbench }>({
  workbench: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const root = await mkdtemp(join(tmpdir(), "workbench-"));
      await cp(FIXTURE, root, { recursive: true });
      process.env["CUBE_REPO_ROOT"] = root;
      const server = await createServer({
        root: WEB_ROOT,
        configLoader: "runner",
        cacheDir: join(WEB_ROOT, "node_modules", ".vite-e2e", String(workerInfo.parallelIndex)),
        logLevel: "warn",
        server: { port: 0, host: "127.0.0.1" },
      });
      await server.listen();
      const url = server.resolvedUrls?.local[0];
      if (url === undefined) {
        throw new Error("workbench server has no URL");
      }
      await use({ url, root, cardsDir: join(root, "cube", "cards") });
      await server.close();
      await rm(root, { recursive: true, force: true });
    },
    { scope: "worker" },
  ],
  freshCube: [
    async ({ workbench }, use) => {
      await resetCube(workbench.root);
      await use(undefined);
    },
    { auto: true },
  ],
});

async function draftSlugs(cardsDir: string): Promise<string[]> {
  const slugs: string[] = [];
  for (const file of (await readdir(cardsDir)).sort()) {
    const slug = file.replace(/\.json$/u, "");
    if ((await readEntry(cardsDir, slug)).status === "draft") {
      slugs.push(slug);
    }
  }
  return slugs;
}

async function seedBurn(page: Page, workbench: Workbench): Promise<void> {
  const patched = await page.request.patch(`${workbench.url}api/cards`, {
    data: {
      changes: ["shock", "lasting-tarfire"].map((slug) => ({ slug, patch: { status: "draft" } })),
    },
  });
  expect(patched.ok()).toBe(true);
  const board = await page.request.put(`${workbench.url}api/board`, {
    data: {
      sections: [{ id: "burn", label: "Burn", cards: ["lasting-tarfire", "shock"], tags: [] }],
    },
  });
  expect(board.ok()).toBe(true);
}

async function openImages(page: Page, url: string, showCut = false): Promise<void> {
  await page.goto(`${url}#/cards`);
  await expect(page.locator(".lab-image").first()).toBeVisible();
  if (showCut) {
    await page.getByRole("checkbox", { name: "Show cut" }).check();
  }
}

async function forgeSetting(page: Page, label: string, value: string): Promise<void> {
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByLabel(label).selectOption(value);
  await dialog.getByRole("button", { name: "Close" }).click();
}

async function chartsOn(page: Page, side: string): Promise<void> {
  await forgeSetting(page, "Charts panel side (wide screens)", side);
}

function tileOf(page: Page, name: string): Locator {
  return page.locator(".lab-tile-cell").filter({ has: page.getByAltText(name, { exact: true }) });
}

async function readEntry(cardsDir: string, slug: string): Promise<CardEntry> {
  return cardEntrySchema.parse(JSON.parse(await readFile(join(cardsDir, `${slug}.json`), "utf8")));
}

async function readLogFile(cardsDir: string): Promise<LogEntry[]> {
  const text = await readFile(join(cardsDir, "..", "log.jsonl"), "utf8").catch(() => "");
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => logEntrySchema.parse(JSON.parse(line)));
}

async function lastSubject(cardsDir: string): Promise<string> {
  return (await readLogFile(cardsDir)).at(-1)?.message.split("\n")[0] ?? "";
}

test("workbench shows live data from cube/cards", async ({ page, workbench }) => {
  const files = (await readdir(workbench.cardsDir)).filter((file) => file.endsWith(".json"));
  await openImages(page, workbench.url, true);
  await expect(page.locator(".lab-image img")).toHaveCount(files.length);
  await expect(page.getByLabel("Your name")).toHaveCount(0);
});

test("the top bar holds brand, views, save state, add, and settings only", async ({
  page,
  workbench,
}) => {
  await page.goto(`${workbench.url}#/`);
  const topbar = page.locator(".topbar");
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
  await expect(topbar.getByRole("link")).toHaveText([
    "Max's Cube",
    "Forge",
    "Board",
    "Tags",
    "Insights",
    "Versions",
    "Log",
    "",
  ]);
  await expect(topbar.getByRole("link").last()).toHaveAccessibleName("Add card");
  await expect(topbar.getByRole("button")).toHaveCount(1);
  await expect(topbar.getByRole("button")).toHaveAccessibleName("Settings");
  await expect(topbar).not.toContainText("live");
  await expect(topbar).not.toContainText("cards ·");
});

test("the add panel opens over any view and the old /add link opens it too", async ({
  page,
  workbench,
}) => {
  await page.goto(`${workbench.url}#/insights`);
  await page.getByRole("link", { name: "Add card" }).click();
  const panel = page.getByRole("dialog", { name: "Add a card" });
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel("Search Scryfall")).toBeFocused();
  await expect(page).toHaveURL(/#\/insights\?add=true/u);
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/#\/insights$/u);

  await page.goto(`${workbench.url}#/add`);
  await expect(page.getByRole("dialog", { name: "Add a card" })).toBeVisible();
});

test("settings save the cube's format and target size to cube.config.json", async ({
  page,
  workbench,
}) => {
  const configFile = join(workbench.root, "cube.config.json");
  await page.goto(`${workbench.url}#/`);
  await expect(page.getByText("target 90–90")).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  const panel = page.getByRole("dialog", { name: "Settings" });
  await expect(panel.getByLabel("Format")).toHaveValue("winston");
  const save = panel.getByRole("button", { name: "Save" });
  await expect(save).toBeDisabled();

  await panel.getByLabel("Min").fill("40");
  await panel.getByLabel("Max").fill("30");
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(save).toBeDisabled();

  await panel.getByLabel("Max").fill("45");
  await save.click();
  await expect(page.getByRole("status")).toContainText("Saved cube settings");
  await expect
    .poll(async () => JSON.parse(await readFile(configFile, "utf8")) as unknown)
    .toEqual({ format: "winston", size: { min: 40, max: 45 } });
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("target 40–45")).toBeVisible();
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

  await page.keyboard.press("Escape");
  await page.getByRole("checkbox", { name: "Show cut" }).check();
  await page.getByRole("button", { name: "Images" }).click();
  await expect(tileOf(page, "Abrade")).toHaveAttribute("data-status", "cut");
  await expect(
    page.getByRole("region", { name: "Draft", exact: true }).getByAltText("Abrade"),
  ).toHaveCount(0);
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

test("editing status, tags and notes auto-saves to disk", async ({ page, workbench }) => {
  const slug = "banishing-light";
  const entry = await readEntry(workbench.cardsDir, slug);
  const disk = (): Promise<CardEntry> => readEntry(workbench.cardsDir, slug);
  await page.goto(`${workbench.url}#/card/${slug}`);

  await page.getByRole("button", { name: "prospect", exact: true }).click();
  await expect.poll(async () => (await disk()).status).toBe("prospect");

  await page.getByLabel("Tag name").fill("removal");
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect.poll(async () => (await disk()).tags).toEqual([...entry.tags, "removal"]);

  await page.getByLabel("Notes").fill("Clean answer, keep.");
  await expect.poll(async () => (await disk()).notes).toBe("Clean answer, keep.");
  await expect(page.getByTestId("save-state")).toHaveText("Saved");

  await page.reload();
  await expect(page.getByRole("button", { name: "prospect", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Notes")).toHaveValue("Clean answer, keep.");
  await expect(
    page.locator(".chips").getByRole("listitem").filter({ hasText: "removal" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Remove tag Removal" }).click();
  await expect.poll(async () => (await disk()).tags).toEqual(entry.tags);
  await expect(page.getByLabel("Section")).toHaveCount(0);
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
    await page.getByLabel("Tag name").fill(tag);
    await page.getByLabel("Tag name").press("Enter");
  }
  await page.getByRole("button", { name: "cut", exact: true }).click();
  await page.getByRole("button", { name: "prospect", exact: true }).click();

  await expect.poll(async () => (await disk()).tags).toEqual(["tempo", "card-draw", "blue"]);
  await expect.poll(async () => (await disk()).status).toBe("prospect");
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "prospect", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".chip")).toHaveText(["Tempo×", "Card draw×", "Blue×"]);

  await page.getByRole("button", { name: "Remove tag Tempo" }).click();
  await page.getByLabel("Tag name").fill("cantrip");
  await page.getByLabel("Tag name").press("Enter");
  await page.getByRole("button", { name: "Remove tag Blue" }).click();
  await expect.poll(async () => (await disk()).tags).toEqual(["card-draw", "cantrip"]);
  await expect(page.locator(".chip")).toHaveText(["Card draw×", "Cantrip×"]);
});

test("leaving the card right after typing keeps every edit", async ({ page, workbench }) => {
  const slug = "essence-scatter";
  const disk = (): Promise<CardEntry> => readEntry(workbench.cardsDir, slug);
  await page.goto(`${workbench.url}#/card/${slug}`);
  await page.getByRole("button", { name: "cut", exact: true }).click();
  await page.getByLabel("Notes").fill("left in a hurry");
  await openImages(page, workbench.url, true);
  await expect(tileOf(page, "Essence Scatter")).toHaveAttribute("data-status", "cut");
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

async function readVocabulary(cardsDir: string): Promise<unknown> {
  return JSON.parse(await readFile(join(cardsDir, "..", "tags.json"), "utf8"));
}

test("a tag outside the vocabulary needs an explicit create", async ({ page, workbench }) => {
  const slug = "abrade";
  const disk = (): Promise<CardEntry> => readEntry(workbench.cardsDir, slug);
  const before = (await disk()).tags;
  await page.goto(`${workbench.url}#/card/${slug}`);

  await page.getByLabel("Tag name").fill("Artifact hate");
  await page.getByRole("button", { name: "Add tag" }).click();
  const create = page.getByRole("group", { name: "Create tag" });
  await expect(create).toContainText("is not a tag yet");
  expect((await disk()).tags).toEqual(before);

  await expect(create.getByRole("button", { name: "Create as archetype" })).toBeFocused();
  await create.getByRole("button", { name: "Create as group" }).click();
  await expect.poll(async () => (await disk()).tags).toEqual([...before, "artifact-hate"]);
  await expect(page.getByLabel("Tag name")).toBeFocused();
  await expect(page.locator(".chip").filter({ hasText: "Artifact hate" })).toBeVisible();
  expect(await readVocabulary(workbench.cardsDir)).toMatchObject({
    tags: expect.arrayContaining([{ id: "artifact-hate", label: "Artifact hate", kind: "group" }]),
  });
  await page.getByLabel("Tag name").fill("can");
  await page
    .getByRole("listbox", { name: "Suggested tags" })
    .getByRole("option", { name: "+ Cantrip" })
    .click();
  await expect
    .poll(async () => (await disk()).tags)
    .toEqual([...before, "artifact-hate", "cantrip"]);
});

test("the tag picker works from the keyboard", async ({ page, workbench }) => {
  const slug = "negate";
  const disk = (): Promise<CardEntry> => readEntry(workbench.cardsDir, slug);
  const before = (await disk()).tags;
  await page.goto(`${workbench.url}#/?card=${slug}`);
  const input = page.getByRole("combobox", { name: "Tag name" });
  const options = page.getByRole("listbox", { name: "Suggested tags" }).getByRole("option");
  const { tags: vocabulary } = (await readVocabulary(workbench.cardsDir)) as {
    tags: { id: string }[];
  };
  const first = vocabulary.find((tag) => !before.includes(tag.id));
  if (!first) {
    throw new Error("test vocabulary has no free tag");
  }

  await input.focus();
  await input.press("ArrowUp");
  await expect(options.last()).toHaveAttribute("aria-selected", "true");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    (await options.last().getAttribute("id")) ?? "",
  );
  await input.press("ArrowDown");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await input.press("Escape");
  await expect(page.getByRole("complementary")).toBeVisible();
  await expect(options.first()).toHaveAttribute("aria-selected", "false");

  await input.press("ArrowDown");
  await input.press("Enter");
  await expect.poll(async () => (await disk()).tags).toEqual([...before, first.id]);
  await expect(input).toBeFocused();
});

test("the tags page renames a tag without touching card files", async ({ page, workbench }) => {
  const slug = "deadeye-brawler";
  await page.goto(`${workbench.url}#/card/${slug}`);
  await page.getByLabel("Tag name").fill("tempo");
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, slug)).tags)
    .toContain("tempo");
  const cardFile = await readFile(join(workbench.cardsDir, `${slug}.json`), "utf8");

  await page.getByRole("link", { name: "Tags" }).click();
  const label = page.getByLabel("Label for tempo");
  await label.fill("Tempo aggro");
  await label.press("Enter");
  await expect
    .poll(async () => readVocabulary(workbench.cardsDir))
    .toMatchObject({
      tags: expect.arrayContaining([{ id: "tempo", label: "Tempo aggro", kind: "archetype" }]),
    });
  await page.getByLabel("Kind for tempo").selectOption("group");
  await expect
    .poll(async () => readVocabulary(workbench.cardsDir))
    .toMatchObject({
      tags: expect.arrayContaining([{ id: "tempo", label: "Tempo aggro", kind: "group" }]),
    });

  expect(await readFile(join(workbench.cardsDir, `${slug}.json`), "utf8")).toBe(cardFile);
  await page.goto(`${workbench.url}#/card/${slug}`);
  await expect(page.locator(".chip").filter({ hasText: "Tempo aggro" })).toBeVisible();

  for (const label of ["tempo", "TEMPO aggro"]) {
    const duplicate = await page.request.post(`${workbench.url}api/tags`, {
      data: { label, kind: "group" },
    });
    expect(duplicate.status()).toBe(409);
  }

  await page.goto(`${workbench.url}#/card/abrade`);
  await page.getByLabel("Tag name").fill("card  draw!");
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect(page.getByRole("group", { name: "Create tag" })).toHaveCount(0);
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, "abrade")).tags)
    .toContain("card-draw");
});

test("bulk edits land on every selected card and undo as one", async ({ page, workbench }) => {
  const slugs = ["auroral-procession", "bake-into-a-pie", "carnage-tyrant"];
  const names = ["Auroral Procession", "Bake into a Pie", "Carnage Tyrant"];
  const before = await Promise.all(slugs.map((slug) => readEntry(workbench.cardsDir, slug)));
  const disk = (): Promise<CardEntry[]> =>
    Promise.all(slugs.map((slug) => readEntry(workbench.cardsDir, slug)));
  await openImages(page, workbench.url, true);

  for (const name of names) {
    await page
      .getByRole("checkbox", { name: `Select ${name}`, exact: true })
      .first()
      .check();
  }
  const bar = page.getByRole("toolbar", { name: "Bulk edit" });
  await expect(bar.getByTestId("selected-count")).toHaveText("3 selected");

  await bar.getByRole("button", { name: "Set prospect" }).click();
  await expect
    .poll(async () => (await disk()).map((entry) => entry.status))
    .toEqual(["prospect", "prospect", "prospect"]);
  const moved = before.filter((entry) => entry.status !== "prospect").length;
  await expect(page.getByRole("status")).toContainText(
    `Saved status prospect on ${String(moved)} cards`,
  );

  await page.getByRole("button", { name: "Undo" }).click();
  await expect
    .poll(async () => (await disk()).map((entry) => entry.status))
    .toEqual(before.map((entry) => entry.status));

  await bar.getByRole("combobox", { name: "Add tag to selected" }).selectOption("removal");
  await bar.getByRole("button", { name: "Apply add tag to selected" }).click();
  await expect
    .poll(async () => (await disk()).map((entry) => entry.tags))
    .toEqual(before.map((entry) => [...entry.tags, "removal"]));

  await bar.getByRole("combobox", { name: "Remove tag from selected" }).selectOption("removal");
  await bar.getByRole("button", { name: "Apply remove tag from selected" }).click();
  await expect.poll(disk).toEqual(before);

  await bar.getByRole("button", { name: "Clear selection" }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.locator(".lab-image-grid .select").first()).toBeFocused();
});

test("the images layout groups by the forge axis and selects a whole group", async ({
  page,
  workbench,
}) => {
  await openImages(page, workbench.url);
  const draft = page.getByRole("region", { name: "Draft", exact: true });
  await page
    .getByRole("group", { name: "Group by" })
    .getByRole("button", { name: "Color" })
    .click();
  const label = "Select all in White";
  await draft.getByRole("checkbox", { name: label }).check();
  const count = await draft
    .locator(".lab-group")
    .filter({ has: page.getByRole("checkbox", { name: label }) })
    .locator(".lab-tile-cell")
    .count();
  expect(count).toBeGreaterThan(0);
  await expect(page.getByTestId("selected-count")).toHaveText(`${String(count)} selected`);
  await page.getByRole("button", { name: "Clear selection" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Images" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("adding a card from Scryfall writes it with its function tags and a batch line", async ({
  page,
  workbench,
}) => {
  await page.goto(`${workbench.url}#/`);
  await page.getByRole("link", { name: "Add card" }).click();
  await page.getByRole("button", { name: "draft", exact: true }).click();
  await page.getByLabel("Search Scryfall").fill('!"Lightning Bolt"');
  await page.getByRole("button", { name: "Add Lightning Bolt", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Lightning Bolt" })).toBeVisible({
    timeout: 20000,
  });
  const entry = await readEntry(workbench.cardsDir, "lightning-bolt");
  expect(entry).toMatchObject({
    status: "draft",
    notes: "",
    source: { batch: "workbench", input: "[  ] Lightning Bolt" },
  });
  expect(entry.tags).toContain("removal");
  const batch = await readFile(join(workbench.cardsDir, "..", "inbox", "workbench.txt"), "utf8");
  expect(batch.split("\n")[entry.source.line - 1]).toBe("[  ] Lightning Bolt");

  await page.getByRole("link", { name: "Add card" }).click();
  await page.getByLabel("Search Scryfall").fill('!"Lightning Bolt"');
  const results = page.getByRole("list", { name: "Search results" });
  const bolt = results
    .getByRole("listitem")
    .filter({ has: page.getByAltText("Lightning Bolt", { exact: true }) });
  await expect(bolt.getByText("In cube")).toBeVisible();
  await expect(bolt.getByRole("button")).toHaveCount(0);
});

test("swapping keeps the old card as cut and can carry its tags", async ({ page, workbench }) => {
  const slug = "daring-saboteur";
  const patched = await page.request.patch(`${workbench.url}api/cards`, {
    data: { changes: [{ slug, patch: { addTags: ["removal"], notes: "too slow" } }] },
  });
  expect(patched.status()).toBe(200);
  const before = await readEntry(workbench.cardsDir, slug);

  await page.goto(`${workbench.url}#/card/${slug}`);
  await page.getByRole("link", { name: "Swap for another card…" }).click();
  const panel = page.getByRole("dialog", { name: "Swap out Daring Saboteur" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: before.status, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await panel.getByLabel("Search Scryfall").fill('!"Counterspell"');
  await panel.getByRole("button", { name: "Swap in Counterspell", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Counterspell" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Daring Saboteur is now cut");
  expect(await readEntry(workbench.cardsDir, slug)).toEqual({ ...before, status: "cut" });
  expect(await readEntry(workbench.cardsDir, "counterspell")).toMatchObject({
    status: before.status,
    tags: before.tags,
    notes: "",
  });
});

test("a swap opened by URL starts from the old card's status", async ({ page, workbench }) => {
  const slug = "deathgorge-scavenger";
  const patched = await page.request.patch(`${workbench.url}api/cards`, {
    data: { changes: [{ slug, patch: { status: "draft" } }] },
  });
  expect(patched.status()).toBe(200);
  await page.goto(`${workbench.url}#/add?replaces=${slug}`);
  await expect(page.getByRole("button", { name: "draft", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

async function draftCount(cardsDir: string): Promise<number> {
  const files = (await readdir(cardsDir)).filter((file) => file.endsWith(".json"));
  const entries = await Promise.all(
    files.map((file) => readEntry(cardsDir, file.replace(/\.json$/u, ""))),
  );
  return entries.filter((entry) => entry.status === "draft").length;
}

test("insights count the draft, follow edits, and scope to a selection", async ({
  page,
  workbench,
}) => {
  await page.goto(`${workbench.url}#/insights`);
  const drafted = await draftCount(workbench.cardsDir);
  const total = page.getByTestId("stat-cards").locator(".stat-value");
  await expect(total).toHaveText(String(drafted));
  await expect(page.getByRole("img", { name: "Mana curve" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Color by mana value" })).toBeVisible();

  const color = page.getByRole("region", { name: "Color", exact: true });
  await color.getByRole("button", { name: "White" }).click();
  await expect(page).toHaveURL(/bucket=presence%3AW|bucket=presence:W/u);
  await color.getByRole("button", { name: "Table" }).click();
  const counts = (await color.locator('tr[data-stat^="color:"] td').allTextContents()).map(Number);
  const nonland = Number(
    await page.getByTestId("stat-nonland").locator(".stat-value").textContent(),
  );
  expect(counts.reduce((sum, value) => sum + value, 0)).toBe(nonland);

  const slug = "dancing-from-dark-to-dawn";
  const entry = await readEntry(workbench.cardsDir, slug);
  const next = entry.status === "draft" ? "cut" : "draft";
  await page.request.patch(`${workbench.url}api/cards`, {
    data: { changes: [{ slug, patch: { status: next } }] },
  });
  await expect(total).toHaveText(String(drafted + (next === "draft" ? 1 : -1)));

  await page.getByLabel("Count cards in").selectOption("all");
  await expect(page).toHaveURL(/scope=all/u);
  const files = (await readdir(workbench.cardsDir)).filter((file) => file.endsWith(".json"));
  await expect(total).toHaveText(String(files.length));

  await openImages(page, workbench.url, true);
  await page.getByRole("checkbox", { name: "Select Abrade", exact: true }).first().check();
  await page.getByRole("link", { name: "Insights" }).click();
  await page.getByLabel("Count cards in").selectOption("selected");
  await expect(total).toHaveText("1");
  await page.getByRole("link", { name: "Forge", exact: true }).click();
  await page.getByRole("button", { name: "Clear selection" }).click();
});

test("clicking a bar, cell, or table row lists the cards in that bucket", async ({
  page,
  workbench,
}) => {
  await page.goto(`${workbench.url}#/insights`);
  const curve = page.getByRole("region", { name: "Mana curve" });
  await curve.locator(".ts-chart__bar path").nth(2).click();
  await expect(page).toHaveURL(/bucket=curve%3A2/u);
  const panel = page.getByRole("complementary", { name: "Cards in bucket" });
  await expect(panel.getByRole("heading")).toContainText("Mana value 2");
  await curve.getByRole("button", { name: "Table" }).click();
  const expected = Number(await curve.locator('tr[data-stat="2"] td').textContent());
  await expect(panel.locator(".strip")).toHaveCount(expected);

  const heat = page.getByRole("region", { name: "Color by mana value" });
  await heat.getByRole("button", { name: "Table" }).click();
  const row = heat.locator('tr[data-stat="colorCurve:R:1"]');
  const red = Number(await row.locator("td").textContent());
  await row.getByRole("button").click();
  await expect(panel.getByRole("heading")).toContainText("Red, mana value 1");
  await expect(panel.locator(".strip")).toHaveCount(red);

  const first = panel.locator(".strip").first();
  const name = (await first.locator(".strip-name").textContent()) ?? "";
  await first.click();
  await expect(page).toHaveURL(/card=/u);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await panel.getByRole("button", { name: "Close card list" }).click();
  await expect(panel).toHaveCount(0);
});

test("insights blocks collapse, move, and keep their layout across reloads", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1300, height: 1000 });
  await page.goto(`${workbench.url}#/insights`);
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  const color = page.locator('[data-block="color"]');
  await page.getByRole("button", { name: "Collapse Color", exact: true }).click();
  await expect(page.getByRole("button", { name: "Expand Color", exact: true })).toBeVisible();
  await expect.poll(async () => (await color.boundingBox())?.height).toBeLessThan(100);

  const pips = page.locator('[data-block="heavy"]');
  const curveBox = await page.locator('[data-block="curve"]').boundingBox();
  const head = await pips.locator(".block-head h2").boundingBox();
  if (!curveBox || !head) {
    throw new Error("blocks not laid out");
  }
  await page.mouse.move(head.x + 10, head.y + 5);
  await page.mouse.down();
  await page.mouse.move(curveBox.x + 40, curveBox.y + 20, { steps: 20 });
  await page.mouse.up();
  await expect.poll(async () => (await pips.boundingBox())?.x).toBeLessThan(100);

  await page.reload();
  await expect(page.getByRole("button", { name: "Expand Color", exact: true })).toBeVisible();
  await expect.poll(async () => (await pips.boundingBox())?.x).toBeLessThan(100);

  await page.getByRole("button", { name: "Reset layout" }).click();
  await expect(page.getByRole("button", { name: "Collapse Color", exact: true })).toBeVisible();
  await expect.poll(async () => (await pips.boundingBox())?.x).toBeGreaterThan(600);
});

test("mana costs render as symbols with a text alternative", async ({ page, workbench }) => {
  await page.goto(`${workbench.url}#/card/banishing-light`);
  const cost = page.getByRole("complementary").getByRole("img", { name: /^Mana cost: /u });
  await expect(cost).toBeVisible();
  await expect(cost.locator("i.ms.ms-cost")).not.toHaveCount(0);
  await expect(cost).not.toHaveAccessibleName(/[{}]/u);
});

test("the large card image keeps the card's shape", async ({ page, workbench }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${workbench.url}#/card/bite-down`);
  const box = await page.getByRole("img", { name: "Bite Down", exact: true }).boundingBox();
  expect(box).not.toBeNull();
  expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(488 / 680, 2);
});

test("forge strips show names and costs, preview on hover, and open the pane", async ({
  page,
  workbench,
}) => {
  await page.goto(workbench.url);
  await expect(page.getByRole("meter", { name: "Draft size" })).toHaveAttribute(
    "aria-valuenow",
    String(await draftCount(workbench.cardsDir)),
  );
  const strip = page.getByRole("link", { name: /^Bite Down/u });
  await expect(strip).toBeVisible();
  await expect(strip.getByRole("img", { name: /^Mana cost: /u })).toBeVisible();

  await strip.hover();
  await expect(page.locator("img.preview")).toBeVisible();

  await strip.click();
  await expect(page).toHaveURL(/[?&]card=bite-down/u);
  const pane = page.getByRole("complementary", { name: "Bite Down" });
  await expect(pane.getByRole("heading", { name: "Bite Down" })).toBeFocused();
  await expect(strip).toHaveAttribute("aria-current", "page");

  await page
    .getByRole("group", { name: "Group by" })
    .getByRole("button", { name: "Color" })
    .click();
  await expect(pane).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(pane).toHaveCount(0);
  await expect(page).not.toHaveURL(/card=/u);
});

test("opening and closing a card keeps the pile's scroll position", async ({ page, workbench }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openImages(page, workbench.url);
  const draft = page.getByRole("region", { name: "Draft", exact: true });
  const tile = draft.locator("a.tile").nth(40);
  await tile.scrollIntoViewIfNeeded();
  const scrolled = (): Promise<number> => draft.evaluate((element) => element.scrollTop);
  const before = await scrolled();
  expect(before).toBeGreaterThan(0);

  await tile.click();
  await expect(page).toHaveURL(/[?&]card=/u);
  await expect(page.locator("aside.pane h1")).toBeFocused();
  expect(await scrolled()).toBe(before);

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).not.toHaveURL(/card=/u);
  expect(await scrolled()).toBe(before);
});

test("a group checkbox shows when only some of its cards are selected", async ({
  page,
  workbench,
}) => {
  await openImages(page, workbench.url);
  const group = page
    .getByRole("region", { name: "Draft", exact: true })
    .locator(".lab-group")
    .first();
  const pile = group.getByRole("checkbox", { name: /^Select all in / });
  await expect(pile).toHaveJSProperty("indeterminate", false);
  await group.locator(".lab-tile-cell .select").first().check();
  await expect(pile).toHaveJSProperty("indeterminate", true);
  await expect(pile).not.toBeChecked();
  await pile.check();
  await expect(pile).toHaveJSProperty("indeterminate", false);
  await expect(pile).toBeChecked();
});

test("card images come from the local image cache", async ({ page, workbench }) => {
  await openImages(page, workbench.url);
  const first = page.locator(".lab-image img").first();
  await expect(first).toHaveAttribute("src", /^\/api\/image\?u=https%3A%2F%2Fcards\.scryfall\.io/u);
  await expect
    .poll(() => first.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);

  const outside = await page.request.get(
    `${workbench.url}api/image?u=${encodeURIComponent("https://example.com/x.jpg")}`,
  );
  expect(outside.status()).toBe(400);
});

test("a card image that keeps failing shows the card name", async ({ page, workbench }) => {
  await page.route("**/api/image?**", (route) => route.fulfill({ status: 502, body: "" }));
  await page.goto(`${workbench.url}#/card/abrade`);
  await expect(page.locator(".card-fallback").filter({ hasText: "Abrade" })).toBeVisible({
    timeout: 10_000,
  });
});

async function readBoard(
  cardsDir: string,
): Promise<{ sections: { label: string; cards: string[]; tags: string[] }[] }> {
  return JSON.parse(await readFile(join(cardsDir, "..", "board.json"), "utf8")) as {
    sections: { label: string; cards: string[]; tags: string[] }[];
  };
}

function strip(scope: Locator, name: string): Locator {
  return scope.locator(`.strip:has(.strip-name:text-is(${JSON.stringify(name)}))`);
}

test("board sections hold dragged cards and survive a reload", async ({ page, workbench }) => {
  const patched = await page.request.patch(`${workbench.url}api/cards`, {
    data: {
      changes: ["shock", "lasting-tarfire", "murder"].map((slug) => ({
        slug,
        patch: { status: "draft" },
      })),
    },
  });
  expect(patched.status()).toBe(200);
  await page.goto(`${workbench.url}#/board`);
  const pool = page.getByRole("complementary", { name: "Card pool" });

  await page.getByRole("button", { name: /New section/u }).click();
  await expect(page.getByLabel("Section name")).toBeFocused();
  await page.getByLabel("Section name").fill("Burn");
  await page.getByLabel("Section name").press("Enter");
  const burn = page.getByRole("region", { name: "Section Burn" });

  await strip(pool, "Shock").dragTo(burn);
  await expect(strip(burn, "Shock")).toBeVisible();
  await burn.getByLabel("Add card to Burn").fill("Lasting Tarfire");
  await burn.getByLabel("Add card to Burn").press("Enter");
  await expect(strip(burn, "Lasting Tarfire")).toBeVisible();

  await strip(pool, "Murder").dragTo(page.getByRole("button", { name: /New section/u }));
  const second = page.getByRole("region", { name: "Section Section 2" });
  await expect(strip(second, "Murder")).toBeVisible();
  await strip(burn, "Shock").dragTo(second);
  await expect(strip(second, "Shock")).toBeVisible();
  await expect(strip(burn, "Shock")).toHaveCount(0);
  await strip(second, "Shock").dragTo(pool);
  await expect(strip(second, "Shock")).toHaveCount(0);
  await strip(pool, "Shock").dragTo(burn);
  await expect(strip(burn, "Shock")).toBeVisible();

  await expect
    .poll(async () => (await readBoard(workbench.cardsDir)).sections)
    .toEqual([
      expect.objectContaining({ label: "Burn", cards: ["lasting-tarfire", "shock"] }),
      expect.objectContaining({ label: "Section 2", cards: ["murder"] }),
    ]);
  await page.reload();
  await expect(strip(burn, "Shock")).toBeVisible();
  await expect(strip(burn, "Lasting Tarfire")).toBeVisible();
  await expect(strip(second, "Murder")).toBeVisible();

  await second.getByRole("button", { name: "Delete section Section 2" }).click();
  await expect(second).toHaveCount(0);
  await burn.getByLabel("Add card to Burn").fill("Opt");
  await burn.getByLabel("Add card to Burn").press("Enter");
  await expect(strip(burn, "Opt")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(strip(second, "Murder")).toBeVisible();
  await expect(strip(burn, "Opt")).toBeVisible();
  await expect
    .poll(async () =>
      (await readBoard(workbench.cardsDir)).sections.map((section) => section.label),
    )
    .toEqual(["Burn", "Section 2"]);
  await burn.getByRole("button", { name: "Take Opt out of Burn" }).click();
  await expect(strip(burn, "Opt")).toHaveCount(0);
});

test("the board pool filters by status and the board lists its controls", async ({
  page,
  workbench,
}) => {
  await seedBurn(page, workbench);
  await page.goto(`${workbench.url}#/board`);
  const pool = page.getByRole("complementary", { name: "Card pool" });
  const total = Number((await pool.getByTestId("pool-count").textContent())?.split(" ")[0]);
  await pool.getByRole("button", { name: "Draft", exact: true }).click();
  await expect(pool.locator('.strip-cell[data-status="prospect"]')).toHaveCount(0);
  const drafted = await pool.locator('.strip-cell[data-status="draft"]').count();
  await pool.getByRole("button", { name: "Prospects", exact: true }).click();
  await expect(pool.locator('.strip-cell[data-status="draft"]')).toHaveCount(0);
  await expect(pool.locator(".strip-cell")).toHaveCount(total - drafted);
  await expect(page.getByRole("list", { name: "Board controls" })).toContainText("Alt copies");
  await pool.getByRole("button", { name: "Both", exact: true }).click();

  await page.mouse.move(0, 0);
  for (const width of [1440, 1000]) {
    await page.setViewportSize({ width, height: 800 });
    const burn = page.getByRole("region", { name: "Section Burn" });
    const firstPool = await pool.locator(".strip").first().boundingBox();
    const firstSection = await burn.locator(".strip").first().boundingBox();
    expect(Math.abs((firstPool?.y ?? 0) - (firstSection?.y ?? 1))).toBeLessThan(1);
    const box = await burn.boundingBox();
    for (const remove of await burn.locator(".strip-remove").all()) {
      const edge = await remove.boundingBox();
      expect((edge?.x ?? 0) + (edge?.width ?? 0)).toBeLessThanOrEqual(
        (box?.x ?? 0) + (box?.width ?? 0),
      );
    }
  }
});

test("a section links several tags and applies them as one undoable edit", async ({
  page,
  workbench,
}) => {
  await seedBurn(page, workbench);
  await page.goto(`${workbench.url}#/board`);
  const burn = page.getByRole("region", { name: "Section Burn" });
  await expect(strip(burn, "Shock")).toBeVisible();

  await burn.getByRole("button", { name: "+ Tags" }).click();
  const editor = page.getByRole("dialog", { name: "Tags for section Burn" });
  const input = editor.getByRole("combobox", { name: "Tag for Burn" });
  await input.fill("Burn");
  await editor.getByRole("button", { name: "Add tag" }).click();
  await editor.getByRole("button", { name: "Create as archetype" }).click();
  await expect(editor.getByRole("button", { name: "Remove tag Burn" })).toBeVisible();
  await input.fill("removal");
  await input.press("ArrowDown");
  await input.press("Enter");
  await editor.getByRole("button", { name: "Done" }).click();

  const chips = burn.getByRole("list", { name: "Tags for Burn" });
  await expect(chips.getByRole("listitem")).toHaveText(["Burn", "Removal"]);
  await expect
    .poll(async () => (await readBoard(workbench.cardsDir)).sections[0]?.tags)
    .toEqual(["burn", "removal"]);
  expect(await readVocabulary(workbench.cardsDir)).toMatchObject({
    tags: expect.arrayContaining([{ id: "burn", label: "Burn", kind: "archetype" }]),
  });

  await burn.getByRole("button", { name: "Apply to 2" }).click();
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, "shock")).tags)
    .toEqual(expect.arrayContaining(["burn", "removal"]));
  expect((await readEntry(workbench.cardsDir, "lasting-tarfire")).tags).toEqual(
    expect.arrayContaining(["burn", "removal"]),
  );
  await expect(burn.getByRole("button", { name: "Applied" })).toBeDisabled();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, "shock")).tags)
    .not.toContain("burn");
  expect((await readEntry(workbench.cardsDir, "shock")).tags).not.toContain("removal");
  await expect(burn.getByRole("button", { name: "Apply to 2" })).toBeVisible();
});

test("board cards sort by a key and a tie-breaker, kept in the URL", async ({
  page,
  workbench,
}) => {
  await seedBurn(page, workbench);
  await page.goto(`${workbench.url}#/board`);
  const burn = page.getByRole("region", { name: "Section Burn" });
  const names = (scope: Locator) => scope.locator(".strip-name").allTextContents();
  await expect.poll(() => names(burn)).toEqual(["Lasting Tarfire", "Shock"]);

  await page.getByLabel("Sort cards by").selectOption("mv");
  await expect.poll(() => names(burn)).toEqual(["Shock", "Lasting Tarfire"]);
  await page.getByRole("button", { name: "+ then" }).click();
  await page.getByLabel("Then by", { exact: true }).selectOption("color");
  await expect(page).toHaveURL(/sort=mv\.color/u);
  await page.getByRole("button", { name: "+ then" }).click();
  await page.getByLabel("Then by, key 3").selectOption("power");
  await page.getByRole("button", { name: "+ then" }).click();
  await page.getByLabel("Then by, key 4").selectOption("toughness");
  await expect(page).toHaveURL(/sort=mv\.color\.power\.toughness/u);
  await page.reload();
  await expect.poll(() => names(burn)).toEqual(["Shock", "Lasting Tarfire"]);
  await expect(page.getByLabel("Then by, key 4")).toHaveValue("toughness");
  await page.getByLabel("Then by, key 3").selectOption("");
  await expect(page).toHaveURL(/sort=mv\.color\.toughness(?!\.)/u);

  await page.getByLabel("Sort cards by").selectOption("added");
  await expect.poll(() => names(burn)).toEqual(["Lasting Tarfire", "Shock"]);
  await expect(page.getByLabel("Then by", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "+ then" })).toHaveCount(0);
  expect((await readBoard(workbench.cardsDir)).sections[0]?.cards).toEqual([
    "lasting-tarfire",
    "shock",
  ]);
});

test("a card's printing is chosen from its printings, shown everywhere, and undoable", async ({
  page,
  workbench,
}) => {
  const slug = "shock";
  const pinned = (await readEntry(workbench.cardsDir, slug)).printing;
  await page.goto(`${workbench.url}#/card/${slug}`);
  const shown = page.getByTestId("shown-printing");
  const before = await shown.textContent();
  const paneImage = page.locator(".pane img").first();
  const imageBefore = await paneImage.getAttribute("src");

  await page.getByRole("button", { name: "Change printing…" }).click();
  const browser = page.getByRole("dialog", { name: "Printings of Shock" });
  const tiles = browser.locator(".printing:not(.printing-default)");
  await expect(tiles.first()).toBeVisible({ timeout: 20_000 });
  expect(await tiles.count()).toBeGreaterThan(5);
  await browser.getByLabel("Filter printings").fill("zzz-no-such-set");
  await expect(tiles).toHaveCount(0);
  await browser.getByLabel("Filter printings").fill("");
  await browser.getByLabel("Filter printings").blur();
  await page.keyboard.press("Escape");
  await expect(browser).toBeHidden();
  await expect(page.getByRole("complementary", { name: "Shock" })).toBeVisible();
  await page.getByRole("button", { name: "Change printing…" }).click();

  await expect(browser.locator(".printing-current")).toHaveCount(1);
  const pick = browser
    .locator(".printing:not(.printing-default):not(:has(.printing-current))")
    .nth(2);
  const setName = ((await pick.locator(".printing-set").textContent()) ?? "").split(" #")[0] ?? "";
  await pick.click();
  await expect(browser).toBeHidden();
  await expect(shown).toContainText(setName);
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, slug)).printing)
    .not.toBe(pinned);
  await expect.poll(() => paneImage.getAttribute("src")).not.toBe(imageBefore);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await readEntry(workbench.cardsDir, slug)).printing).toBe(pinned);
  await expect(shown).toHaveText(before ?? "");
});

test("a chosen printing that can't be found falls back and says so", async ({
  page,
  workbench,
}) => {
  const slug = "opt";
  const entry = await readEntry(workbench.cardsDir, slug);
  const path = join(workbench.cardsDir, `${slug}.json`);
  await writeFile(
    path,
    `${JSON.stringify({ ...entry, printing: "00000000-0000-4000-8000-000000000000" }, null, 2)}\n`,
  );
  await page.goto(`${workbench.url}#/card/${slug}`);
  await expect(page.getByRole("note")).toHaveText("(chosen printing unavailable)");
  await writeFile(path, `${JSON.stringify(entry, null, 2)}\n`);
  await expect(page.getByRole("note")).toHaveCount(0);
});

test("the tags view counts overlaps and filters forge to one", async ({ page, workbench }) => {
  for (const label of ["Overlap A", "Overlap B"]) {
    const created = await page.request.post(`${workbench.url}api/tags`, {
      data: { label, kind: "group" },
    });
    expect(created.status()).toBe(200);
  }
  const patched = await page.request.patch(`${workbench.url}api/cards`, {
    data: {
      changes: [
        { slug: "adanto-vanguard", patch: { addTags: ["overlap-a", "overlap-b"] } },
        { slug: "awaken-the-honored-dead", patch: { addTags: ["overlap-b"] } },
        { slug: "biotech-specialist", patch: { addTags: ["overlap-a"] } },
      ],
    },
  });
  expect(patched.status()).toBe(200);
  await page.goto(`${workbench.url}#/`);
  await page.getByRole("navigation", { name: "Views" }).getByRole("link", { name: "Tags" }).click();
  await page.getByRole("button", { name: "Overlap A 2" }).click();
  await page.getByRole("button", { name: "Overlap B 2" }).click();
  await expect(page).toHaveURL(/tags=overlap-a%2Coverlap-b/u);

  const venn = page.getByRole("img", { name: /^Venn diagram of Overlap A, Overlap B/u });
  await expect(venn.locator('[data-key="0"]')).toHaveText("1");
  await expect(venn.locator('[data-key="1"]')).toHaveText("1");
  await expect(venn.locator('[data-key="0+1"]')).toHaveText("1");

  const lit = page.locator(".lab-cell:not([data-dim]) .lab-strip-name");
  const pills = page.getByRole("group", { name: "Applied filters" });
  await page.getByRole("link", { name: "Overlap A + Overlap B: 1 card" }).click();
  await expect(page).toHaveURL(/#\/$/u);
  await expect(pills.getByRole("button", { name: /^Remove / })).toHaveText([
    "tag:overlap-a tag:overlap-b ×",
  ]);
  await expect(lit).toHaveText(["Adanto Vanguard"]);

  await page.goBack();
  const label = await venn.locator('[data-key="0"]').boundingBox();
  if (!label) {
    throw new Error("no Overlap A-only label");
  }
  await page.mouse.click(label.x + label.width / 2, label.y - 12);
  await expect(page).toHaveURL(/#\/$/u);
  await expect(pills.getByRole("button", { name: /^Remove / })).toHaveText([
    "tag:overlap-a -tag:overlap-b ×",
  ]);
  await expect(lit).toHaveText(["Biotech Specialist"]);
});

test("a saved version compares with the current cube", async ({ page, workbench }) => {
  const slug = "brazen-scourge";
  const drafted = await page.request.patch(`${workbench.url}api/cards/${slug}`, {
    data: { status: "draft" },
  });
  expect(drafted.status()).toBe(200);
  await page.goto(`${workbench.url}#/`);
  await page
    .getByRole("navigation", { name: "Views" })
    .getByRole("link", { name: "Versions" })
    .click();
  await page.getByLabel("Version name").fill("Before the cut");
  await page.getByRole("button", { name: "Save version" }).click();
  const row = page.locator("tr[data-version$='-before-the-cut']");
  await expect(row).toContainText("Before the cut");
  const versionsDir = join(workbench.cardsDir, "..", "versions");
  const [file] = await readdir(versionsDir);
  expect(file).toMatch(/^\d{4}-\d{2}-\d{2}-before-the-cut\.json$/u);

  const patched = await page.request.patch(`${workbench.url}api/cards/${slug}`, {
    data: { status: "cut", addTags: ["tempo"] },
  });
  expect(patched.status()).toBe(200);
  await row.getByRole("button", { name: "Compare with now" }).click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}-before-the-cut&to=current/u);

  const moved = page.getByRole("region", { name: "Draft → Cut" });
  await expect(moved.getByRole("link", { name: "Brazen Scourge" })).toBeVisible();
  const edited = page.getByRole("region", { name: "Edited" });
  await expect(edited.locator("li").filter({ hasText: "Brazen Scourge" })).toContainText("+ Tempo");

  await page.getByLabel("To").selectOption({ label: "Before the cut" });
  await expect(page.getByText("No changes.")).toBeVisible();

  await page.getByLabel("Version name").fill("before the CUT");
  await page.getByRole("button", { name: "Save version" }).click();
  await expect(page.getByText(/already exists/u)).toBeVisible();
});

test("each view keeps its choices across views and reloads", async ({ page, workbench }) => {
  const views = page.getByRole("navigation", { name: "Views" });
  const go = async (name: string) => {
    await views.getByRole("link", { name, exact: true }).click();
  };
  const groupBy = page.getByRole("group", { name: "Group by" });
  await page.goto(`${workbench.url}#/`);
  await groupBy.getByRole("button", { name: "Color" }).click();
  await page.getByRole("button", { name: "Images" }).click();
  await go("Insights");
  await page.getByLabel("Count cards in").selectOption("all");
  await go("Board");
  const pool = page.getByRole("complementary", { name: "Card pool" });
  await pool.getByRole("button", { name: "Draft", exact: true }).click();
  await pool.getByLabel("Filter cards").fill("sh");
  await page.getByLabel("Sort cards by").selectOption("mv");

  for (const reload of [false, true]) {
    if (reload) {
      await page.reload();
    }
    await go("Forge");
    await expect(groupBy.getByRole("button", { name: "Color" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: "Images" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await go("Insights");
    await expect(page.getByLabel("Count cards in")).toHaveValue("all");
    await go("Board");
    await expect(page).toHaveURL(/sort=mv/u);
    await expect(pool.getByRole("button", { name: "Draft", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(pool.getByLabel("Filter cards")).toHaveValue("sh");
  }

  await go("Insights");
  await page.getByLabel("Count cards in").selectOption("draft");
  await go("Tags");
  await page.goto(`${workbench.url}#/?q=tag:removal`);
  await expect(page).toHaveURL(/#\/$/u);
  await expect(
    page.getByRole("group", { name: "Applied filters" }).getByRole("button", { name: /^Remove / }),
  ).toHaveText(["tag:removal ×"]);
  await expect(groupBy.getByRole("button", { name: "Color" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await go("Insights");
  await expect(page.getByLabel("Count cards in")).toHaveValue("draft");
  await expect(page).not.toHaveURL(/scope=/u);
});

test("table toggles, filter views, and the log's filter and stat group survive a reload", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1300, height: 1000 });
  const filters = await page.request.put(`${workbench.url}api/filters`, {
    data: { filters: [{ id: "filter-red", label: "Red", query: "c=r", view: "curve" }] },
  });
  expect(filters.ok()).toBe(true);
  const patched = await page.request.patch(`${workbench.url}api/cards`, {
    data: { changes: [{ slug: "shock", patch: { status: "prospect" } }] },
  });
  expect(patched.ok()).toBe(true);

  await page.goto(`${workbench.url}#/insights`);
  const curve = page.getByRole("region", { name: "Mana curve", exact: true });
  const red = page.getByRole("region", { name: "Red", exact: true });
  await curve.getByRole("button", { name: "Table" }).click();
  await red.getByRole("button", { name: "Table" }).click();
  await page.goto(`${workbench.url}#/log`);
  await page.getByLabel("Filter the log").fill("shock");
  await page.getByRole("tab", { name: "Curve" }).click();

  await page.reload();
  await expect(page.getByLabel("Filter the log")).toHaveValue("shock");
  await expect(page.getByRole("tab", { name: "Curve" })).toHaveAttribute("aria-selected", "true");
  await page.goto(`${workbench.url}#/insights`);
  await expect(curve.getByRole("button", { name: "Table" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(red.getByRole("button", { name: "Table" })).toHaveAttribute("aria-pressed", "true");
});

async function readFilters(cardsDir: string): Promise<{
  filters: {
    id: string;
    label: string;
    query: string;
    view: string;
  }[];
}> {
  return JSON.parse(await readFile(join(cardsDir, "..", "filters.json"), "utf8")) as {
    filters: {
      id: string;
      label: string;
      query: string;
      view: string;
    }[];
  };
}

test("a saved filter becomes an Insights block that can chart, hide, and be deleted", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1300, height: 1000 });
  await page.goto(`${workbench.url}#/insights`);
  await page.getByRole("button", { name: "+ New filter" }).click();
  const editor = page.getByRole("dialog", { name: "New filter" });
  await editor.getByLabel("Filter name").fill("Cheap red");
  const query = editor.getByRole("textbox", { name: "Filter query" });
  await query.pressSequentially("c=r mv<=2 ");
  const pills = editor.locator(".query-pill-text");
  await expect(pills).toHaveText(["c=r", "mv<=2"]);
  await query.pressSequentially("-t:crea");
  await expect(editor.getByRole("option", { selected: true })).toContainText("-t:creature");
  await query.press("Tab");
  await expect(pills).toHaveText(["c=r", "mv<=2", "-t:creature"]);
  await query.pressSequentially("pow>");
  await expect(editor.locator(".query-error")).toBeVisible();
  await expect(editor.getByRole("button", { name: "Add to dashboard" })).toBeDisabled();
  await query.fill("");
  await expect(editor.locator(".query-error")).toHaveCount(0);
  const preview = Number(
    (await editor.getByTestId("filter-preview-count").textContent())?.split(" ")[0],
  );
  expect(preview).toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/filter-editor.png" });
  await editor.getByRole("button", { name: "Add to dashboard" }).click();
  await expect(editor).toHaveCount(0);

  const block = page.getByRole("region", { name: "Cheap red" });
  await expect(block.locator(".strip")).toHaveCount(preview);
  await expect(block.getByRole("heading")).toContainText(String(preview));
  await expect
    .poll(async () => (await readFilters(workbench.cardsDir)).filters)
    .toEqual([
      {
        id: expect.stringMatching(/^filter-[a-z0-9]+$/u),
        label: "Cheap red",
        query: "c=r mv<=2 -t:creature",
        view: "cards",
      },
    ]);
  await block.scrollIntoViewIfNeeded();
  const firstStrip = block.locator(".strip").first();
  await firstStrip.hover();
  const stripBox = await firstStrip.boundingBox();
  const previewBox = await page.locator(".preview").boundingBox();
  expect(previewBox?.y ?? 9999).toBeLessThan((stripBox?.y ?? 0) + (stripBox?.height ?? 0));

  await block.getByLabel("Show Cheap red as").selectOption("curve");
  await expect(block.getByRole("img", { name: "Mana curve" })).toBeVisible();
  await expect
    .poll(async () => (await readFilters(workbench.cardsDir)).filters[0]?.view)
    .toBe("curve");
  await block.getByRole("button", { name: "Table" }).click();
  const row = block.locator('tr[data-stat="2"]');
  const two = Number(await row.locator("td").textContent());
  await row.getByRole("button").click();
  await expect(page).toHaveURL(/in=filter-/u);
  const panel = page.getByRole("complementary", { name: "Cards in bucket" });
  await expect(panel.getByRole("heading")).toContainText("Mana value 2");
  await expect(panel.locator(".strip")).toHaveCount(two);
  await panel.getByRole("button", { name: "Close card list" }).click();

  await page.getByRole("button", { name: "Hide Mana curve", exact: true }).click();
  await block.getByRole("button", { name: "Hide Cheap red" }).click();
  await expect(page.locator('[data-block="curve"]')).toHaveCount(0);
  await expect(block).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-block="curve"]')).toHaveCount(0);
  const menu = page.locator(".blocks-menu");
  await menu.getByText(/Blocks/u).click();
  await expect(menu).toContainText("2 hidden");
  await menu.getByLabel("Cheap red").check();
  await expect(block).toBeVisible();
  await page.getByRole("button", { name: "Reset layout" }).click();
  await expect(page.locator('[data-block="curve"]')).toHaveCount(1);

  await block.getByRole("button", { name: "Edit" }).click();
  await page
    .getByRole("dialog", { name: "Edit Cheap red" })
    .getByRole("button", { name: "Delete filter" })
    .click();
  await expect(block).toHaveCount(0);
  await expect.poll(async () => (await readFilters(workbench.cardsDir)).filters).toEqual([]);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(block).toBeVisible();
  await expect.poll(async () => (await readFilters(workbench.cardsDir)).filters).toHaveLength(1);
});

test("a chart bucket saves as a filter", async ({ page, workbench }) => {
  await page.goto(`${workbench.url}#/insights`);
  await page
    .getByRole("region", { name: "Mana curve" })
    .locator(".ts-chart__bar path")
    .nth(2)
    .click();
  const panel = page.getByRole("complementary", { name: "Cards in bucket" });
  const count = await panel.locator(".strip").count();
  await panel.getByRole("button", { name: "Save as filter" }).click();
  const editor = page.getByRole("dialog", { name: "New filter" });
  await expect(editor.getByLabel("Filter name")).toHaveValue("Mana value 2");
  await expect(editor.locator(".query-pill-text")).toHaveText(["mv=2"]);
  await expect(editor.getByTestId("filter-preview-count")).toHaveText(`${String(count)} cards`);
  await editor.getByRole("button", { name: "Add to dashboard" }).click();
  await expect(page.getByRole("region", { name: "Mana value 2" }).locator(".strip")).toHaveCount(
    count,
  );
});

test("typing or joins the next term with the last pill, and and adds nothing", async ({
  page,
  workbench,
}) => {
  await page.goto(`${workbench.url}#/insights`);
  await page.getByRole("button", { name: "+ New filter" }).click();
  const editor = page.getByRole("dialog", { name: "New filter" });
  const query = editor.getByRole("textbox", { name: "Filter query" });
  const pills = editor.locator(".query-pill-text");
  await query.pressSequentially("t:creature c=r or");
  await expect(editor.getByRole("listbox", { name: "Suggestions" })).toHaveCount(0);
  await query.pressSequentially(" c=g ");
  await expect(pills).toHaveText(["t:creature", "(c=r or c=g)"]);
  await query.pressSequentially("and mv<=2 ");
  await expect(pills).toHaveText(["t:creature", "(c=r or c=g)", "mv<=2"]);
  await expect(editor.locator(".query-error")).toHaveCount(0);
  await editor.getByRole("button", { name: "Close filter editor" }).click();
});

test("Forge moves cards by drag and filters them with typed, applied, and peeked queries", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const files = (await readdir(workbench.cardsDir)).filter((file) => file.endsWith(".json"));
  const entries = await Promise.all(
    files.map(async (file) => {
      const slug = file.replace(/\.json$/u, "");
      return { slug, ...(await readEntry(workbench.cardsDir, slug)) };
    }),
  );
  const prospect = entries.find((entry) => entry.status === "prospect");
  if (!prospect) {
    throw new Error("fixture has no prospect");
  }
  const drafted = await draftCount(workbench.cardsDir);

  await page.goto(`${workbench.url}#/`);
  const count = page.locator(".lab-count-value");
  await expect(count).toHaveText(String(drafted));
  const draft = page.getByRole("region", { name: "Draft", exact: true });
  const prospects = page.getByRole("region", { name: "Prospects", exact: true });
  const named = (pile: Locator, name: string): Locator =>
    pile.locator(`.lab-strip:has(.lab-strip-name:text-is(${JSON.stringify(name)}))`);

  await named(prospects, prospect.name).dragTo(draft);
  await expect(named(draft, prospect.name)).toBeVisible();
  await expect(count).toHaveText(String(drafted + 1));
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, prospect.slug)).status)
    .toBe("draft");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(named(prospects, prospect.name)).toBeVisible();
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, prospect.slug)).status)
    .toBe("prospect");

  const cells = draft.locator(".lab-cell");
  const dim = draft.locator(".lab-cell[data-dim]");
  const total = await cells.count();
  await expect(dim).toHaveCount(0);
  const query = page.getByRole("textbox", { name: "Filter the Forge" });
  await query.pressSequentially("c=r");
  await expect.poll(async () => dim.count()).toBeGreaterThan(0);
  const redDim = await dim.count();
  await query.press("Enter");
  await expect(page.getByRole("button", { name: "Remove c=r" })).toBeVisible();
  await expect(query).toHaveValue("");
  await expect(dim).toHaveCount(redDim);

  const curve = page.getByRole("region", { name: "Curve" });
  const two = curve.locator('.lab-bar[aria-label^="MV 2:"]');
  await two.hover();
  await expect.poll(async () => dim.count()).toBeGreaterThan(redDim);
  await page.locator(".lab-top h1").hover();
  await expect(dim).toHaveCount(redDim);
  await two.click();
  await expect(page.getByRole("button", { name: "Remove MV 2" })).toBeVisible();
  const both = await dim.count();
  expect(both).toBeGreaterThan(redDim);

  await forgeSetting(page, "Cards that don't match the filter", "hide");
  await expect(cells).toHaveCount(total - both);
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove c=r" })).toBeVisible();
  await expect(cells).toHaveCount(total - both);
  await forgeSetting(page, "Cards that don't match the filter", "dim");
  await page.getByRole("button", { name: "Remove MV 2" }).click();
  await expect(dim).toHaveCount(redDim);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByLabel("Name for c=r").fill("Red");
  await page.getByLabel("Name for c=r").press("Enter");
  await expect(page.getByRole("button", { name: "Remove Red" })).toBeVisible();
  await expect
    .poll(async () => (await readFilters(workbench.cardsDir)).filters)
    .toContainEqual(expect.objectContaining({ label: "Red", query: "c=r" }));
  const filters = page.getByRole("region", { name: "Filters" });
  await expect(filters.getByRole("button", { name: /^Red/u, pressed: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove Red" }).click();
  await expect(dim).toHaveCount(0);
  await filters.getByRole("button", { name: /^Red/u }).hover();
  await expect(dim).toHaveCount(redDim);
  await page.screenshot({ path: "test-results/lab-peek.png" });
});

test("a Forge chart pins to a scope or follows the filter, with its own baseline", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(`${workbench.url}#/`);
  const curve = page.getByRole("region", { name: "Curve" });
  const three = curve.locator('.lab-bar[aria-label^="MV 3:"]');
  const unfiltered = await three.getAttribute("aria-label");
  const query = page.getByRole("textbox", { name: "Filter the Forge" });
  await query.pressSequentially("c=g");
  await query.press("Enter");
  await expect(three).not.toHaveAttribute("aria-label", unfiltered ?? "");
  await expect(curve.locator(".lab-bar-base").first()).toBeVisible();

  await curve.hover();
  await curve.getByLabel("Baseline for Curve").click();
  await expect(curve.locator(".lab-bar-base")).toHaveCount(0);
  await expect(page.getByLabel("Baseline", { exact: true })).toBeChecked();

  await curve.getByLabel("Scope of Curve").selectOption("draft");
  await expect(three).toHaveAttribute("aria-label", unfiltered ?? "");
  await expect(curve.getByLabel("Baseline for Curve")).toHaveCount(0);
  await page.reload();
  await expect(three).toHaveAttribute("aria-label", unfiltered ?? "");
  await curve.hover();
  await curve.getByLabel("Scope of Curve").selectOption("filter");
  await expect(three).not.toHaveAttribute("aria-label", unfiltered ?? "");
  await expect(curve.locator(".lab-bar-base")).toHaveCount(0);
  await curve.getByLabel("Baseline for Curve").click();
  await expect(curve.locator(".lab-bar-base").first()).toBeVisible();
  await page.getByRole("button", { name: "Remove c=g" }).click();
});

async function readLayouts(cardsDir: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(join(cardsDir, "..", "layouts.json"), "utf8"));
  } catch {
    return undefined;
  }
}

test("a named Forge layout saves to the cube and brings its settings back", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(`${workbench.url}#/`);
  const draft = page.getByRole("region", { name: "Draft", exact: true });
  await draft.getByRole("button", { name: "Rows" }).click();
  await draft.getByRole("button", { name: "None", exact: true }).click();
  await chartsOn(page, "left");
  const query = page.getByRole("textbox", { name: "Filter the Forge" });
  await query.pressSequentially("t:creature");
  await query.press("Enter");
  await expect(draft.locator(".lab-group")).toHaveCount(1);

  await page.getByRole("button", { name: /^Layouts/u }).click();
  await page.getByLabel("Layout name").fill("Creature rows");
  await page.getByLabel("Layout name").press("Enter");
  await page.getByLabel("Layout name").press("Escape");
  await expect
    .poll(async () => readLayouts(workbench.cardsDir))
    .toEqual({
      layouts: [
        {
          id: expect.stringMatching(/^layout-[a-z0-9]+$/u),
          label: "Creature rows",
          settings: expect.objectContaining({
            "labc.view": "rows",
            "lab.axis": "none",
            "labc.dockAt": "left",
            "lab.pills": ["x:t:creature"],
          }),
        },
      ],
    });

  await draft.getByRole("button", { name: "Columns" }).click();
  await draft.getByRole("button", { name: "Mana value", exact: true }).click();
  await chartsOn(page, "top");
  await page.getByRole("button", { name: "Remove t:creature" }).click();
  await expect(page.locator(".lab")).toHaveAttribute("data-dock", "top");

  await page.reload();
  await page.getByRole("button", { name: /^Layouts/u }).click();
  await page.getByRole("button", { name: "Creature rows", exact: true }).click();
  await expect(page.locator(".lab")).toHaveAttribute("data-dock", "left");
  await expect(page.getByRole("button", { name: "Remove t:creature" })).toBeVisible();
  await expect(draft.locator(".lab-group")).toHaveCount(1);
  await expect(draft.getByRole("button", { name: "Rows" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator(".lab")).toHaveAttribute("data-dock", "left");

  await page.getByRole("button", { name: /^Layouts/u }).click();
  await page.getByRole("button", { name: "Delete layout Creature rows" }).click();
  await expect.poll(async () => readLayouts(workbench.cardsDir)).toEqual({ layouts: [] });
  await page.getByRole("button", { name: /^Layouts/u }).click();
  await draft.getByRole("button", { name: "Columns" }).click();
  await draft.getByRole("button", { name: "Mana value", exact: true }).click();
  await chartsOn(page, "top");
  await page.getByRole("button", { name: "Remove t:creature" }).click();
});

test("Forge saves its stack of applied filters as one filter", async ({ page, workbench }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(`${workbench.url}#/`);
  const query = page.getByRole("textbox", { name: "Filter the Forge" });
  await query.pressSequentially("c=u");
  await query.press("Enter");
  await page
    .getByRole("region", { name: "Curve" })
    .locator('.lab-bar[aria-label^="MV 2:"]')
    .click();
  const dim = page.locator(".lab-cell[data-dim]");
  const dimmed = await dim.count();
  await page.getByRole("button", { name: "Save as filter" }).click();
  await page.getByLabel("Name for the applied filters").fill("Cheap blue");
  await page.getByLabel("Name for the applied filters").press("Enter");
  await expect(page.getByRole("button", { name: "Remove Cheap blue" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove c=u" })).toHaveCount(0);
  await expect(dim).toHaveCount(dimmed);
  await expect
    .poll(async () => (await readFilters(workbench.cardsDir)).filters)
    .toContainEqual(expect.objectContaining({ label: "Cheap blue", query: "c=u mv=2" }));
  await page.getByRole("button", { name: "Remove Cheap blue" }).click();
});

test("every Forge chart previews a hovered card's move and peeks at a hovered bar", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto(`${workbench.url}#/`);
  await chartsOn(page, "left");
  const menu = page.locator(".lab-menu").first();
  await menu.getByRole("button", { name: /^Blocks/u }).click();
  for (const box of await menu.locator("input[type=checkbox]").all()) {
    await box.check();
  }
  await menu.getByRole("button", { name: /^Blocks/u }).click();

  const color = page.getByRole("region", { name: "Color", exact: true });
  const types = page.getByRole("region", { name: "Card types" });
  const summary = page.getByRole("region", { name: "Summary" });
  await expect(color.getByRole("listitem")).not.toHaveCount(0);
  await expect(types.getByRole("listitem")).not.toHaveCount(0);
  await expect(summary.locator(".lab-ghost-label")).toHaveCount(0);

  const prospect = page.locator('[data-pile="prospects"] .lab-strip').first();
  await prospect.hover();
  await expect(summary.locator(".lab-ghost-label").first()).toHaveText("+1");
  await expect(types.locator(".lab-ghost-label").first()).toHaveText("+1");
  await page.locator(".lab-top h1").hover();
  await expect(summary.locator(".lab-ghost-label")).toHaveCount(0);

  const dim = page.locator(".lab-cell[data-dim]");
  const redBar = color.getByRole("listitem", { name: /^Red:/u });
  await redBar.hover();
  await expect.poll(async () => dim.count()).toBeGreaterThan(0);
  await redBar.click();
  await expect(page.getByRole("button", { name: "Remove Has Red" })).toBeVisible();
  await expect(color.getByRole("listitem", { name: /^Red:/u })).toHaveAttribute(
    "aria-label",
    /^Red: (\d+) of \1$/u,
  );
  await page.getByRole("button", { name: "Remove Has Red" }).click();
  await chartsOn(page, "top");
});

test("Forge creature charts peek, pick, and preview a move in a top and a side dock", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto(`${workbench.url}#/`);
  const menu = page.locator(".lab-menu").first();
  await menu.getByRole("button", { name: /^Blocks/u }).click();
  for (const box of await menu.locator("input[type=checkbox]").all()) {
    await box.check();
  }
  await menu.getByRole("button", { name: /^Blocks/u }).click();
  const balance = page.getByRole("region", { name: "Creature balance" });
  const combat = page.getByRole("region", { name: "Combat matchups" });
  const dim = page.locator(".lab-cell[data-dim]");
  const prospects = page.locator('[data-pile="prospects"] .lab-strip');

  for (const dock of ["top", "left"]) {
    await chartsOn(page, dock);
    await balance.scrollIntoViewIfNeeded();
    const rows = balance.getByRole("listitem");
    await expect(rows).not.toHaveCount(0);
    await expect(balance.locator(".lab-ghost-label")).toHaveCount(0);
    await rows.first().hover();
    await expect.poll(async () => dim.count()).toBeGreaterThan(0);
    await page.locator(".lab-top h1").hover();

    await combat.scrollIntoViewIfNeeded();
    const dots = combat.getByRole("listitem");
    await expect(dots).not.toHaveCount(0);
    await dots.first().hover();
    await expect.poll(async () => dim.count()).toBeGreaterThan(0);
    await page.locator(".lab-top h1").hover();
    await expect(dim).toHaveCount(0);

    let ghosts = { balance: false, combat: false };
    for (let at = 0; at < (await prospects.count()) && !(ghosts.balance && ghosts.combat); at++) {
      await prospects.nth(at).hover();
      await expect(page.locator(".lab-count-ghost")).toBeVisible();
      ghosts = {
        balance: ghosts.balance || (await balance.locator(".lab-ghost-label").count()) > 0,
        combat:
          ghosts.combat ||
          ((await combat.locator(".lab-combat-dot .lab-ghost-label").count()) > 0 &&
            (await combat.locator(".lab-combat-count .lab-ghost-label").count()) > 0),
      };
    }
    expect(ghosts).toEqual({ balance: true, combat: true });
    await page.locator(".lab-top h1").hover();
  }

  const row = balance.getByRole("listitem").first();
  const label = (await row.getAttribute("aria-label")) ?? "";
  const mv = /^MV (\S+):/u.exec(label)?.[1] ?? "";
  await row.click();
  const pill = page.getByRole("button", { name: `Remove Creatures · MV ${mv}` });
  await expect(pill).toBeVisible();
  await expect(row).toHaveAttribute("data-picked", "");
  await pill.click();
  await chartsOn(page, "top");

  await balance.hover();
  await page.getByRole("button", { name: "Collapse Creature balance" }).click();
  const rail = page.locator('.lab-block[data-block="lab:balance"]');
  await expect.poll(async () => (await rail.boundingBox())?.width ?? 0).toBeLessThan(50);
  await expect(rail.locator(".lab-tile-head")).toHaveCSS("writing-mode", "vertical-rl");
  await page.getByRole("button", { name: "Expand Creature balance" }).click();
  await expect.poll(async () => (await rail.boundingBox())?.width ?? 0).toBeGreaterThan(200);
});

test("Forge sorts its cards by a chain of keys that survives a reload", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(`${workbench.url}#/`);
  const draft = page.getByRole("region", { name: "Draft", exact: true });
  await draft.getByRole("button", { name: "Rows" }).click();
  await draft.getByRole("button", { name: "Card type", exact: true }).click();
  await draft.getByRole("button", { name: /^Sort:/u }).click();
  const sorter = draft.getByRole("group", { name: "Sort order" });
  await sorter.getByLabel("Sort cards by").selectOption("power");
  await sorter.getByRole("button", { name: "+ then" }).click();
  await sorter.getByLabel("Then by", { exact: true }).selectOption("toughness");
  const creatures = draft
    .locator(".lab-group")
    .filter({ has: page.locator(".lab-group-head", { hasText: /^Creature/u }) });
  const stats = async (): Promise<number[][]> =>
    (await creatures.locator(".lab-row-pt").allTextContents())
      .map((pt) => pt.split("/").map(Number))
      .filter((pair) => pair.every((value) => Number.isFinite(value)));
  const ascending = (pairs: number[][]): boolean =>
    pairs.every((pair, at) => {
      const prev = pairs[at - 1];
      const [p = 0, t = 0] = pair;
      const [pp = 0, pt = 0] = prev ?? [];
      return prev === undefined || pp < p || (pp === p && pt <= t);
    });
  await expect.poll(async () => (await stats()).length).toBeGreaterThan(5);
  expect(ascending(await stats())).toBe(true);
  await page.reload();
  await expect(draft.getByRole("button", { name: "Sort: Power, Toughness" })).toBeVisible();
  await draft.getByRole("button", { name: "Color", exact: true }).click();
  await expect(draft.getByRole("button", { name: "Sort: Mana value" })).toBeVisible();
  await draft.getByRole("button", { name: "Card type", exact: true }).click();
  await expect(draft.getByRole("button", { name: "Sort: Power, Toughness" })).toBeVisible();
  await draft.getByRole("button", { name: /^Sort:/u }).click();
  await expect(sorter.getByLabel("Then by", { exact: true })).toHaveValue("toughness");
  expect(ascending(await stats())).toBe(true);
  await sorter.getByLabel("Sort cards by").selectOption("mv");
  await sorter.getByLabel("Then by", { exact: true }).selectOption("color");
  await draft.getByRole("button", { name: "Mana value", exact: true }).click();
  await draft.getByRole("button", { name: "Columns" }).click();
});

test("clicks in one Forge chart or together, and tag charts switch to chips", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${workbench.url}#/`);
  const heat = page.getByRole("region", { name: "Color × mana value" });
  const cells = heat.locator(".lab-heat-cell:not([data-empty])");
  const dim = page.locator(".lab-cell[data-dim]");
  await cells.nth(1).click();
  const one = await dim.count();
  await cells.nth(9).click();
  const pill = page.locator(".lab-pill");
  await expect(pill).toHaveCount(1);
  await expect(pill).toContainText(" or ");
  await page.locator(".lab-top h1").hover();
  await expect.poll(async () => dim.count()).toBeLessThan(one);
  const both = await dim.count();
  await expect(heat.locator(".lab-heat-cell[data-picked]")).toHaveCount(2);
  await cells.nth(14).hover();
  await expect.poll(async () => dim.count()).toBeLessThan(both);
  await cells.nth(9).click();
  await expect(pill).not.toContainText(" or ");
  await expect(heat.locator(".lab-heat-cell[data-picked]")).toHaveCount(1);
  await cells.nth(1).click();
  await expect(pill).toHaveCount(0);

  const groups = page.getByRole("region", { name: "Groups" });
  await groups.scrollIntoViewIfNeeded();
  await groups.hover();
  const toggle = groups.getByLabel("Show Groups as chips");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await groups.hover();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("an opened card stays highlighted in Forge and previews its move in every chart", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${workbench.url}#/`);
  const prospect = page.locator('[data-pile="prospects"] .lab-cell').first();
  const name = (await prospect.locator(".lab-strip-name").textContent()) ?? "";
  await prospect.locator(".lab-strip").click();
  await expect(page.getByRole("complementary", { name })).toBeVisible();
  await page.mouse.move(5, 500);
  await expect(prospect).toHaveAttribute("data-selected", "");
  const count = Number(await page.locator(".lab-count-value").textContent());
  await expect(page.locator(".lab-count-ghost")).toHaveText(`→ ${String(count + 1)}`);
  const summary = page.getByRole("region", { name: "Summary" });
  await expect(summary.locator(".lab-ghost-label").first()).toHaveText("+1");
  await page.locator('[data-pile="prospects"] .lab-strip').nth(1).hover();
  await expect(page.locator(".lab-count-ghost")).toHaveText(`→ ${String(count + 2)}`);
  await expect(summary.locator(".lab-ghost-label").first()).toHaveText("+2");
  await page.mouse.move(5, 500);
  await expect(page.locator(".lab-count-ghost")).toHaveText(`→ ${String(count + 1)}`);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".lab-cell[data-selected]")).toHaveCount(0);
  await expect(summary.locator(".lab-ghost-label")).toHaveCount(0);
});

test("Forge Pending queues adds and cuts, previews them together, and applies as one undoable edit", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${workbench.url}#/`);
  const draft = page.getByRole("region", { name: "Draft", exact: true });
  const prospects = page.getByRole("region", { name: "Prospects", exact: true });
  const pending = page.getByRole("region", { name: "Pending", exact: true });
  const count = Number(await page.locator(".lab-count-value").textContent());
  const ghost = page.locator(".lab-count-ghost");
  const nameOf = async (cell: Locator): Promise<string> =>
    (await cell.locator(".lab-strip-name").textContent()) ?? "";
  const slugOf = async (cell: Locator): Promise<string> =>
    ((await cell.locator(".lab-strip").getAttribute("href")) ?? "").replace(/^.*card=/u, "");

  const add = prospects.locator(".lab-cell").first();
  const addName = await nameOf(add);
  const addSlug = await slugOf(add);
  const cutA = draft.locator(".lab-cell").nth(0);
  const cutB = draft.locator(".lab-cell").nth(1);
  const cutAName = await nameOf(cutA);
  const cutASlug = await slugOf(cutA);
  const cutBName = await nameOf(cutB);
  const cutBSlug = await slugOf(cutB);

  await pending.getByRole("button", { name: "Expand Pending" }).click();
  await expect(pending).toContainText("-click a card");
  await add.locator(".lab-strip").dragTo(pending);
  await expect(prospects.locator(`.lab-cell[data-pending="add"]`)).toHaveCount(1);
  await cutA.locator(".lab-strip").click({ modifiers: ["Alt"] });
  await cutB.locator(".lab-strip").click({ modifiers: ["Alt"] });
  await expect(page.getByRole("complementary", { name: cutAName })).toHaveCount(0);
  await expect(draft.locator(`.lab-cell[data-pending="cut"]`)).toHaveCount(2);
  await page.mouse.move(5, 990);
  await expect(pending.locator(".pending-tally")).toHaveText("+1−2");
  await expect(ghost).toHaveText(`→ ${String(count - 1)}`);
  await expect(page.locator(".lab-count-value")).toHaveText(String(count));
  expect((await readEntry(workbench.cardsDir, cutASlug)).status).toBe("draft");

  await page.reload();
  await expect(pending.locator(".pending-tally")).toHaveText("+1−2");
  await expect(pending.locator(".lab-strip-name")).toHaveCount(3);
  for (const name of [addName, cutAName, cutBName]) {
    await expect(pending.locator(".lab-strip-name", { hasText: name })).toHaveCount(1);
  }

  await pending.locator(".lab-cell", { hasText: cutBName }).hover();
  await pending.getByRole("button", { name: `Remove ${cutBName} from pending` }).click();
  await page.mouse.move(5, 990);
  await expect(pending.locator(".pending-tally")).toHaveText("+1−1");
  await expect(ghost).toHaveText(`→ ${String(count)}`);

  await expect(pending.getByLabel("Apply message")).toHaveAttribute("placeholder", "Lab: +1 −1");
  await pending.getByLabel("Apply message").fill("Trim the curve");
  await pending.getByLabel("Why").fill("Too many 3s.");
  await pending.getByRole("button", { name: "Apply" }).click();
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, addSlug)).status)
    .toBe("draft");
  await expect.poll(() => lastSubject(workbench.cardsDir)).toBe("Trim the curve");
  const applied = (await readLogFile(workbench.cardsDir)).at(-1)?.message ?? "";
  expect(applied).toContain("Trim the curve\n\nToo many 3s.\n\nCard: ");
  expect(applied).toContain(`Card: ${addName} prospect→draft`);
  expect(applied).toMatch(/^(?:Counts|Curve|Colors|Types|Tags): /mu);
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, cutASlug)).status)
    .toBe("prospect");
  expect((await readEntry(workbench.cardsDir, cutBSlug)).status).toBe("draft");
  await expect(pending.locator(".pending-tally")).toHaveText("+0−0");
  await expect(page.locator(".lab-cell[data-pending]")).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, addSlug)).status)
    .toBe("prospect");
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, cutASlug)).status)
    .toBe("draft");
  await expect.poll(() => lastSubject(workbench.cardsDir)).toBe("Undo Trim the curve");
});

test("the change log survives a reload and reverts entries singly and in bulk", async ({
  page,
  workbench,
}) => {
  const entries = page.getByTestId("log-entry");
  const openFolds = async (): Promise<void> => {
    const closed = page.locator('[data-testid="log-fold"] details:not([open]) > summary');
    while ((await closed.count()) > 0) {
      await closed.first().click();
    }
  };
  const entry = (subject: string): Locator =>
    entries.filter({
      has: page.locator(".log-subject", { hasText: new RegExp(`^${subject}$`, "u") }),
    });
  const [kept = "", other = ""] = await draftSlugs(workbench.cardsDir);
  const prospect =
    (await readdir(workbench.cardsDir))
      .map((file) => file.replace(/\.json$/u, ""))
      .sort()
      .find((candidate) => candidate !== kept && candidate !== other) ?? "";
  await page.request.patch(`${workbench.url}api/cards`, {
    data: { changes: [{ slug: prospect, patch: { status: "prospect" } }] },
  });
  const swap = async (subject: string, body: string, toDraft: string, toProspect: string) => {
    const response = await page.request.patch(`${workbench.url}api/cards`, {
      data: {
        changes: [
          { slug: toDraft, patch: { status: "draft" } },
          { slug: toProspect, patch: { status: "prospect" } },
        ],
      },
      headers: { "X-Log-Subject": subject, "X-Log-Body": encodeURIComponent(body) },
    });
    expect(response.ok()).toBe(true);
  };
  await swap("Trim the curve", "Too many 3s.", prospect, kept);
  await swap("Undo Trim the curve", "", kept, prospect);
  const added = await readEntry(workbench.cardsDir, prospect);
  const slug = prospect;
  const status = async (): Promise<string> => (await readEntry(workbench.cardsDir, slug)).status;

  await page.goto(`${workbench.url}#/log`);
  await expect(entry("Trim the curve")).toContainText("Too many 3s.");
  await expect(entry("Trim the curve").locator('[data-trailer="Card"]')).toHaveCount(2);
  await page.reload();
  await expect(page.getByTestId("log-fold").first()).toBeVisible();
  await openFolds();
  await expect(entry("Undo Trim the curve")).toBeVisible();

  await entry("Undo Trim the curve")
    .getByRole("button", { name: /^Revert/u })
    .click();
  await expect.poll(status).toBe("draft");
  await openFolds();
  await expect(entry('Revert "Undo Trim the curve"')).toHaveAttribute("data-source", "revert");

  await openFolds();
  await entry("Undo Trim the curve")
    .getByRole("button", { name: /^Revert/u })
    .click();
  await expect(page.getByRole("alert")).toContainText("Changed since");
  expect(await status()).toBe("draft");

  const drafted: string[] = [];
  for (const file of (await readdir(workbench.cardsDir)).sort()) {
    const other = file.replace(/\.json$/u, "");
    if (other !== slug && (await readEntry(workbench.cardsDir, other)).status === "draft") {
      drafted.push(other);
    }
  }
  const [one = "", two = ""] = drafted;
  for (const [other, subject] of [
    [one, "Move one"],
    [two, "Move two"],
  ] as const) {
    const response = await page.request.patch(`${workbench.url}api/cards/${other}`, {
      data: { status: "cut" },
      headers: { "X-Log-Subject": subject },
    });
    expect(response.ok()).toBe(true);
  }
  await expect(entry("Move two")).toBeVisible();
  await entry("Move one").getByRole("checkbox").check();
  await entry("Move two").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Revert 2 selected" }).click();
  await expect.poll(async () => (await readEntry(workbench.cardsDir, one)).status).toBe("draft");
  expect((await readEntry(workbench.cardsDir, two)).status).toBe("draft");
  await expect(
    page.getByTestId("log-fold").filter({ hasText: "3 edits that cancel out" }),
  ).toBeVisible();
  await openFolds();
  await expect(entry("Revert 2 entries")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await readEntry(workbench.cardsDir, one)).status).toBe("cut");
  await expect.poll(async () => (await readEntry(workbench.cardsDir, two)).status).toBe("cut");

  await page.getByLabel("Filter the log").fill(added.name);
  for (const item of await entries.all()) {
    await expect(item).toContainText(added.name);
  }

  await page.goto(`${workbench.url}#/log?card=${slug}`);
  const history = page.getByRole("region", { name: "History" });
  await expect(
    history.getByTestId("card-history-entry").filter({ hasText: "Too many 3s." }),
  ).toContainText("Trim the curve");
});

test("the stats timeline plots log entries and links both ways with them", async ({
  page,
  workbench,
}) => {
  const entries = page.getByTestId("log-entry");
  const timeline = page.getByRole("region", { name: "Stats timeline" });
  const plot = timeline.locator(".log-timeline-plot");
  const dots = plot.locator("svg circle");
  const drafted: string[] = [];
  for (const file of (await readdir(workbench.cardsDir)).sort()) {
    const slug = file.replace(/\.json$/u, "");
    if ((await readEntry(workbench.cardsDir, slug)).status === "draft") {
      drafted.push(slug);
    }
  }
  for (const [slug, status, body] of [
    [drafted[0] ?? "", "prospect", "Timeline why"],
    [drafted[1] ?? "", "prospect", ""],
    [drafted[2] ?? "", "prospect", ""],
  ] as const) {
    const response = await page.request.patch(`${workbench.url}api/cards/${slug}`, {
      data: { status },
      headers: { "X-Log-Subject": `Timeline ${status}`, "X-Log-Body": encodeURIComponent(body) },
    });
    expect(response.ok()).toBe(true);
  }
  const all = await readLogFile(workbench.cardsDir);
  const folded = foldedIds(foldCanceled(all));
  const logged = all.filter((item) => !folded.has(item.id));
  const whys = logged.filter((item) => parseMessage(item.message).body !== "").length;

  await page.goto(`${workbench.url}#/log`);
  await expect(timeline.getByRole("tab", { name: /^Counts/u })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(timeline.getByRole("checkbox", { name: "draft" })).toBeChecked();
  expect(whys).toBeGreaterThan(0);
  await expect(dots).toHaveCount(logged.length);
  await expect(plot.locator('svg circle[r="5.5"]')).toHaveCount(whys);

  await timeline.getByRole("tab", { name: "Colors" }).click();
  await timeline.getByRole("checkbox", { name: "R", exact: true }).check();
  await expect(dots).toHaveCount(logged.length * 2);
  await page.reload();
  await expect(dots).toHaveCount(logged.length * 2);
  await expect(timeline.getByRole("tab", { name: /^Colors/u })).toContainText("1");

  await timeline.getByRole("tab", { name: "Curve" }).click();
  const curve = timeline.getByLabel("Curve stats").getByRole("checkbox");
  const curveChecked = async (): Promise<boolean[]> =>
    Promise.all((await curve.all()).map((box) => box.isChecked()));
  await timeline.getByRole("button", { name: "All", exact: true }).click();
  expect(await curveChecked()).not.toContain(false);
  await timeline.getByRole("button", { name: "None", exact: true }).click();
  expect(await curveChecked()).not.toContain(true);
  await curve.nth(1).click();
  await curve.nth(3).click({ modifiers: ["Shift"] });
  expect(await curveChecked()).toEqual((await curveChecked()).map((_, i) => i >= 1 && i <= 3));
  await curve.nth(2).click({ modifiers: ["Alt"] });
  await expect(timeline.getByRole("tab", { name: /^Colors/u })).not.toContainText("1");
  expect(await curveChecked()).toEqual((await curveChecked()).map((_, i) => i === 2));
  const first = await curve.nth(0).boundingBox();
  const fourth = await curve.nth(4).boundingBox();
  if (!first || !fourth) {
    throw new Error("expected the curve checkboxes on screen");
  }
  await page.mouse.move(first.x + 4, first.y + 4);
  await page.mouse.down();
  await page.mouse.move(fourth.x + 4, fourth.y + 4, { steps: 2 });
  await page.mouse.up();
  expect(await curveChecked()).toEqual((await curveChecked()).map((_, i) => i <= 4));
  await curve.nth(0).focus();
  await page.keyboard.press("Space");
  await expect(curve.nth(0)).not.toBeChecked();
  await expect(dots).toHaveCount(logged.length * 4);

  await expect(timeline.getByRole("button", { name: "Change" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(plot).toContainText("±0");
  await timeline.getByRole("button", { name: "Values" }).click();
  await expect(plot).not.toContainText("±0");

  const last = page.locator(`#log-entry-${logged[0]?.id ?? ""}`);
  await last.hover();
  await expect(last).toHaveAttribute("data-active", "true");
  await expect(plot).toHaveAttribute("data-active-index", "0");

  await page.getByLabel("Filter the log").fill("no entry says this");
  await expect(entries).toHaveCount(0);
  await dots.first().click({ force: true });
  await expect(page.getByLabel("Filter the log")).toHaveValue("");
  const active = page.locator('[data-testid="log-entry"][data-active="true"]');
  await expect(active).toHaveCount(1);
  await expect(active).toBeInViewport();
  await expect
    .poll(async () => {
      const panel = await timeline.boundingBox();
      const box = await active.boundingBox();
      return panel && box
        ? box.y >= panel.y + panel.height - 1 || box.x + box.width <= panel.x + 1
        : false;
    })
    .toBe(true);
  const index = await plot.getAttribute("data-active-index");
  const id = (await active.getAttribute("id"))?.replace(/^log-entry-/u, "");
  expect(logged.findIndex((item) => item.id === id)).toBe(Number(index));
});

test("edits that cancel out fold into one line and leave the timeline", async ({
  page,
  workbench,
}) => {
  const timeline = page.getByRole("region", { name: "Stats timeline" });
  const dots = timeline.locator(".log-timeline-plot svg circle");
  let slug = "";
  for (const file of (await readdir(workbench.cardsDir)).sort()) {
    const candidate = file.replace(/\.json$/u, "");
    if ((await readEntry(workbench.cardsDir, candidate)).status === "draft") {
      slug = candidate;
      break;
    }
  }
  const [, first = ""] = await draftSlugs(workbench.cardsDir);
  const seeded = await page.request.patch(`${workbench.url}api/cards/${first}`, {
    data: { status: "prospect" },
  });
  expect(seeded.ok()).toBe(true);
  await page.goto(`${workbench.url}#/log`);
  await timeline.getByRole("button", { name: "None", exact: true }).click();
  await timeline.getByRole("tab", { name: /^Counts/u }).click();
  await timeline.getByRole("checkbox", { name: "draft" }).check();
  const plottedBefore = await dots.count();

  for (const status of ["cut", "draft"]) {
    const response = await page.request.patch(`${workbench.url}api/cards/${slug}`, {
      data: { status },
      headers: { "X-Log-Subject": `Fold ${status}` },
    });
    expect(response.ok()).toBe(true);
  }
  const fold = page
    .getByTestId("log-fold")
    .filter({ hasText: "2 edits that cancel out" })
    .filter({ hasText: "Fold cut" });
  await expect(fold).toBeVisible();
  await expect(fold.getByText("Fold cut")).toBeHidden();
  await expect(dots).toHaveCount(plottedBefore);
  await fold.locator("summary").click();
  await expect(fold.getByText("Fold cut")).toBeVisible();
  await expect(fold.getByTestId("log-entry")).toHaveCount(2);
});

test("the active nav link stays readable on hover and a selected strip's ring sits inside it", async ({
  page,
  workbench,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`${workbench.url}#/insights`);
  const active = page.locator('.views a[data-status="active"]');
  await expect(active).toHaveText("Insights");
  await active.hover();
  await expect(active).toHaveCSS("color", "rgb(255, 255, 255)");

  await page.goto(workbench.url);
  await expect(page.getByRole("meter", { name: "Draft size" })).toHaveAttribute(
    "aria-valuenow",
    String(await draftCount(workbench.cardsDir)),
  );
  const strip = page.getByRole("link", { name: /^Bite Down/u });
  await strip.click();
  await expect(strip).toHaveAttribute("aria-current", "page");
  await expect(strip).toHaveCSS("box-shadow", /inset/u);
});

test("moving between Forge chart marks goes from one peek to the next without a reset", async ({
  page,
  workbench,
}) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto(`${workbench.url}#/`);
  const color = page.getByRole("region", { name: "Color", exact: true });
  const red = color.getByRole("listitem", { name: /^Red:/u });
  const green = color.getByRole("listitem", { name: /^Green:/u });
  const dim = page.locator(".lab-cell[data-dim]");
  await red.hover();
  await expect.poll(async () => dim.count()).toBeGreaterThan(0);

  await page.evaluate(() => {
    const flags = window as unknown as { resets: number };
    flags.resets = 0;
    new MutationObserver(() => {
      if (document.querySelector(".lab-cell[data-dim]") === null) {
        flags.resets += 1;
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-dim"] });
  });
  const from = await red.boundingBox();
  const to = await green.boundingBox();
  if (!from || !to) {
    throw new Error("Color bars have no box");
  }
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  const resets = await page.evaluate(() => (window as unknown as { resets: number }).resets);
  expect(resets).toBe(0);

  await page.locator(".lab-top h1").hover();
  await expect(dim).toHaveCount(0);
});

async function croppedRings(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const room = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--ring-room"),
    );
    if (!(room > 0)) {
      return ["--ring-room is not set on :root"];
    }
    const targets =
      "a[href], button, input, select, textarea, summary, [tabindex], .lab-bar-fill, .lab-hbar-fill, .tile";
    const inset = ".strip, .lab-strip, .lab-row";
    const found = new Set<string>();
    for (const target of document.querySelectorAll(targets)) {
      if (target instanceof SVGElement || target.closest("svg") || target.matches(inset)) {
        continue;
      }
      const box = target.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) {
        continue;
      }
      let clip = target.parentElement;
      while (
        clip &&
        getComputedStyle(clip).overflowX === "visible" &&
        getComputedStyle(clip).overflowY === "visible"
      ) {
        clip = clip.parentElement;
      }
      if (!clip) {
        continue;
      }
      const frame = clip.getBoundingClientRect();
      const left = box.left - frame.left - clip.clientLeft + clip.scrollLeft;
      const top = box.top - frame.top - clip.clientTop + clip.scrollTop;
      const gaps = [
        left,
        top,
        clip.scrollWidth - left - box.width,
        clip.scrollHeight - top - box.height,
      ];
      if (gaps.some((gap) => gap < room - 0.5)) {
        found.add(`${clip.className} > ${target.tagName.toLowerCase()}.${target.className}`);
      }
    }
    return [...found];
  });
}

test("no view puts a ringed control flush against a clipping edge", async ({ page, workbench }) => {
  for (const width of [1440, 900]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of [
      "",
      "cards",
      "board",
      "tags",
      "insights",
      "versions",
      "log",
      "add",
      "insights?bucket=curve%3A2",
    ]) {
      await page.goto(`${workbench.url}#/${view}`);
      await expect(page.getByText("Loading cube")).toHaveCount(0);
      await expect(page.locator("main a[href], main button").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await croppedRings(page), `#/${view} at ${String(width)}px`).toEqual([]);
    }
  }
});
