import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Locator } from "@playwright/test";
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
      await writeFile(join(root, "cube", "board.json"), `${JSON.stringify({ sections: [] })}\n`);
      await writeFile(join(root, "cube", "filters.json"), `${JSON.stringify({ filters: [] })}\n`);
      const cardsDir = join(root, "cube", "cards");
      for (const file of await readdir(cardsDir)) {
        const path = join(cardsDir, file);
        const entry = cardEntrySchema.parse(JSON.parse(await readFile(path, "utf8")));
        await writeFile(path, `${JSON.stringify({ ...entry, tags: [] }, null, 2)}\n`);
      }
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
  await page.goto(`${workbench.url}#/cards`);
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

  await page.getByRole("link", { name: "Cards", exact: true }).click();
  await expect(page.locator('[data-pile="cut"] img[alt="Abrade"]')).toBeVisible();
  await expect(page.locator('[data-pile="draft"] img[alt="Abrade"]')).toHaveCount(0);
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
  await expect(page.getByTestId("save-state")).toHaveText("all changes saved");

  await page.reload();
  await expect(page.getByRole("button", { name: "prospect", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Notes")).toHaveValue("Clean answer, keep.");
  await expect(page.getByRole("listitem").filter({ hasText: "removal" })).toBeVisible();

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
  await expect(page.getByTestId("save-state")).toHaveText("all changes saved");
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
  await page.getByRole("link", { name: "Cards", exact: true }).click();
  await expect(page.locator('[data-pile="cut"] img[alt="Essence Scatter"]')).toBeVisible();
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
  await page.goto(`${workbench.url}#/cards`);

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
  await expect(page.getByLabel("Organize by")).toBeFocused();
});

test("the grid organizes by status and tag kind", async ({ page, workbench }) => {
  const slug = "clarion-conqueror";
  const created = await page.request.post(`${workbench.url}api/tags`, {
    data: { label: "Pile test", kind: "archetype" },
  });
  expect(created.status()).toBe(200);
  const patched = await page.request.patch(`${workbench.url}api/cards`, {
    data: { changes: [{ slug, patch: { addTags: ["pile-test", "removal"] } }] },
  });
  expect(patched.status()).toBe(200);
  await page.goto(`${workbench.url}#/cards`);
  const organize = page.getByLabel("Organize by");
  const tile = (pile: string) => page.locator(`[data-pile="${pile}"] img[alt="Clarion Conqueror"]`);

  await organize.selectOption("archetype");
  await expect(tile("tag-pile-test")).toBeVisible();
  await expect(tile("no-archetype")).toHaveCount(0);
  await expect(page).toHaveURL(/by=archetype/u);

  await organize.selectOption("group");
  await expect(tile("tag-removal")).toBeVisible();
  await expect(tile("no-group")).toHaveCount(0);
  await page.reload();
  await expect(organize).toHaveValue("group");
  await expect(tile("tag-removal")).toBeVisible();

  await expect(organize.locator('option[value="section"]')).toHaveCount(0);

  await organize.selectOption("status");
  const draft = page.locator('[data-pile="draft"]');
  await draft.getByRole("checkbox", { name: "Select all in Draft" }).check();
  const count = await draft.locator(".tile").count();
  await expect(page.getByTestId("selected-count")).toHaveText(`${String(count)} selected`);
  await page.getByRole("button", { name: "Clear selection" }).click();

  await organize.selectOption("overview");
  await expect(page).not.toHaveURL(/by=/u);
});

test("adding a card from Scryfall writes it with its function tags and a batch line", async ({
  page,
  workbench,
}) => {
  await page.goto(`${workbench.url}#/cards`);
  await page.getByRole("link", { name: "Add card" }).click();
  await page.getByRole("button", { name: "draft", exact: true }).click();
  await page.getByLabel("Search Scryfall").fill('!"Lightning Bolt"');
  await page.getByRole("button", { name: "Add Lightning Bolt", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Lightning Bolt" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Swap out Daring Saboteur" })).toBeVisible();
  await expect(page.getByRole("button", { name: before.status, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByLabel("Search Scryfall").fill('!"Counterspell"');
  await page.getByRole("button", { name: "Swap in Counterspell", exact: true }).click();

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

  await page.getByRole("link", { name: "Cards", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select Abrade", exact: true }).first().check();
  await page.getByRole("link", { name: "Insights" }).click();
  await page.getByLabel("Count cards in").selectOption("selected");
  await expect(total).toHaveText("1");
  await page.getByRole("link", { name: "Cards", exact: true }).click();
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

test("the Wall shows names and costs, previews on hover, and opens the pane", async ({
  page,
  workbench,
}) => {
  await page.goto(workbench.url);
  const strip = page.getByRole("link", { name: /^Bite Down/u });
  await expect(strip).toBeVisible();
  await expect(strip.getByRole("img", { name: /^Mana cost: /u })).toBeVisible();
  await expect(page.locator('[data-column="1"] .column-count').first()).not.toHaveText("0");

  await strip.hover();
  await expect(page.locator("img.preview")).toBeVisible();

  await strip.click();
  await expect(page).toHaveURL(/[?&]card=bite-down/u);
  const pane = page.getByRole("complementary", { name: "Bite Down" });
  await expect(pane.getByRole("heading", { name: "Bite Down" })).toBeFocused();
  await expect(strip).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Color" }).click();
  await expect(page).toHaveURL(/by=color/u);
  await expect(pane).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(pane).toHaveCount(0);
  await expect(page).not.toHaveURL(/card=/u);
  await expect(page).toHaveURL(/by=color/u);
});

test("opening and closing a card keeps the scroll position", async ({ page, workbench }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${workbench.url}#/cards`);
  const tiles = page.locator("a.tile");
  await expect(tiles.first()).toBeVisible();
  const tile = tiles.nth(40);
  await tile.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);

  await tile.click();
  await expect(page).toHaveURL(/[?&]card=/u);
  await expect(page.locator("aside.pane h1")).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).not.toHaveURL(/card=/u);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test("dragging a card between the Wall and the tray changes its status", async ({
  page,
  workbench,
}) => {
  const config = JSON.parse(
    await readFile(join(workbench.cardsDir, "..", "..", "cube.config.json"), "utf8"),
  ) as { size: { min: number; max: number } };
  const files = (await readdir(workbench.cardsDir)).filter((file) => file.endsWith(".json"));
  const entries = await Promise.all(
    files.map(async (file) => ({
      slug: file.replace(/\.json$/u, ""),
      ...(await readEntry(workbench.cardsDir, file.replace(/\.json$/u, ""))),
    })),
  );
  const prospect = entries.find((entry) => entry.status === "prospect");
  if (!prospect) {
    throw new Error("fixture has no prospect");
  }
  const drafted = await draftCount(workbench.cardsDir);

  await page.goto(workbench.url);
  const gauge = page.getByTestId("draft-gauge");
  await expect(gauge).toContainText(`target ${String(config.size.min)}–${String(config.size.max)}`);
  await expect(page.getByRole("meter", { name: "Draft size" })).toHaveAttribute(
    "aria-valuenow",
    String(drafted),
  );

  const strip = page.locator(
    `.tray .strip:has(.strip-name:text-is(${JSON.stringify(prospect.name)}))`,
  );
  await strip.dragTo(page.locator(".wall-body"));
  await expect(
    page.locator(`.wall-body .strip:has(.strip-name:text-is(${JSON.stringify(prospect.name)}))`),
  ).toBeVisible();
  await expect(page.getByRole("meter", { name: "Draft size" })).toHaveAttribute(
    "aria-valuenow",
    String(drafted + 1),
  );
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, prospect.slug)).status)
    .toBe("draft");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect
    .poll(async () => (await readEntry(workbench.cardsDir, prospect.slug)).status)
    .toBe("prospect");
  await expect(
    page.locator(`.tray .strip:has(.strip-name:text-is(${JSON.stringify(prospect.name)}))`),
  ).toBeVisible();
});

test("a pile checkbox shows when only some of its cards are selected", async ({
  page,
  workbench,
}) => {
  await page.goto(`${workbench.url}#/cards`);
  const draft = page.locator('[data-pile="draft"]');
  const pile = draft.getByRole("checkbox", { name: "Select all in Draft" });
  await expect(pile).toHaveJSProperty("indeterminate", false);
  await draft.locator(".tile-cell .select").first().check();
  await expect(pile).toHaveJSProperty("indeterminate", true);
  await expect(pile).not.toBeChecked();
  await pile.check();
  await expect(pile).toHaveJSProperty("indeterminate", false);
  await expect(pile).toBeChecked();
});

test("card images come from the local image cache", async ({ page, workbench }) => {
  await page.goto(`${workbench.url}#/cards`);
  const first = page.locator(".grid img").first();
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
  await page.goto(`${workbench.url}#/board`);
  const burn = page.getByRole("region", { name: "Section Burn" });
  const names = (scope: Locator) => scope.locator(".strip-name").allTextContents();
  await expect.poll(() => names(burn)).toEqual(["Lasting Tarfire", "Shock"]);

  await page.getByLabel("Sort cards by").selectOption("mv");
  await expect.poll(() => names(burn)).toEqual(["Shock", "Lasting Tarfire"]);
  await page.getByLabel("Then by").selectOption("color");
  await expect(page).toHaveURL(/sort=mv\.color/u);
  await page.reload();
  await expect.poll(() => names(burn)).toEqual(["Shock", "Lasting Tarfire"]);

  await page.getByLabel("Sort cards by").selectOption("added");
  await expect.poll(() => names(burn)).toEqual(["Lasting Tarfire", "Shock"]);
  await expect(page.getByLabel("Then by")).toBeDisabled();
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

test("the tags view counts overlaps and filters the Wall to one", async ({ page, workbench }) => {
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

  await page.getByRole("link", { name: "Overlap A + Overlap B: 1 card" }).click();
  await expect(page).toHaveURL(/#\/\?with=overlap-a%2Coverlap-b$/u);
  const filter = page.getByRole("status", { name: "Tag filter" });
  await expect(filter).toContainText("Tagged Overlap A + Overlap B");
  await expect(page.locator(".strip-name")).toHaveText(["Adanto Vanguard"]);

  await page.goBack();
  const label = await venn.locator('[data-key="0"]').boundingBox();
  if (!label) {
    throw new Error("no Overlap A-only label");
  }
  await page.mouse.click(label.x + label.width / 2, label.y - 12);
  await expect(page).toHaveURL(/with=overlap-a&without=overlap-b/u);
  await expect(filter).toContainText("Tagged Overlap A, not Overlap B");
  await expect(page.locator(".strip-name")).toHaveText(["Biotech Specialist"]);

  await filter.getByRole("button", { name: "Clear filter" }).click();
  await expect(filter).toHaveCount(0);
  await expect(page).not.toHaveURL(/with=/u);
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
  await page.goto(`${workbench.url}#/`);
  await page.getByRole("group", { name: "Columns" }).getByRole("button", { name: "Color" }).click();
  await page.getByRole("button", { name: /^Prospects/u }).click();
  await go("Cards");
  await page.getByLabel("Organize by").selectOption("status");
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
    await go("Wall");
    await expect(page).toHaveURL(/#\/\?by=color$/u);
    await expect(page.getByRole("button", { name: /^Prospects/u })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await go("Cards");
    await expect(page.getByLabel("Organize by")).toHaveValue("status");
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
  await page.goto(`${workbench.url}#/?with=removal`);
  await expect(page).toHaveURL(/with=removal/u);
  await expect(page).toHaveURL(/by=color/u);
  await go("Insights");
  await expect(page.getByLabel("Count cards in")).toHaveValue("draft");
  await expect(page).not.toHaveURL(/scope=/u);
});

async function readFilters(cardsDir: string): Promise<{
  filters: {
    id: string;
    label: string;
    chips: { bucket: string; not?: boolean }[];
    view: string;
  }[];
}> {
  return JSON.parse(await readFile(join(cardsDir, "..", "filters.json"), "utf8")) as {
    filters: {
      id: string;
      label: string;
      chips: { bucket: string; not?: boolean }[];
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
  await editor.getByRole("button", { name: "Red", exact: true }).first().click();
  await editor.getByRole("button", { name: "Mana value 1", exact: true }).click();
  await editor.getByRole("button", { name: "Mana value 2", exact: true }).click();
  await editor
    .getByRole("group", { name: "Card type" })
    .getByRole("button", { name: "Creature" })
    .click();
  await editor
    .getByRole("group", { name: "Card type" })
    .getByRole("button", { name: "Creature" })
    .click();
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
        id: "filter-1",
        label: "Cheap red",
        chips: [
          { bucket: "color:R" },
          { bucket: "curve:1" },
          { bucket: "curve:2" },
          { bucket: "type:creature", not: true },
        ],
        view: "cards",
      },
    ]);
  await block.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/filter-block.png" });

  await block.getByLabel("Show Cheap red as").selectOption("curve");
  await expect(block.getByRole("img", { name: "Mana curve" })).toBeVisible();
  await expect
    .poll(async () => (await readFilters(workbench.cardsDir)).filters[0]?.view)
    .toBe("curve");
  await block.getByRole("button", { name: "Table" }).click();
  const row = block.locator('tr[data-stat="2"]');
  const two = Number(await row.locator("td").textContent());
  await row.getByRole("button").click();
  await expect(page).toHaveURL(/in=filter-1/u);
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
  await expect(editor.getByTestId("filter-preview-count")).toHaveText(`${String(count)} cards`);
  await editor.getByRole("button", { name: "Add to dashboard" }).click();
  await expect(page.getByRole("region", { name: "Mana value 2" }).locator(".strip")).toHaveCount(
    count,
  );
});
