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

test("editing status, section, tags and notes auto-saves to disk", async ({ page, workbench }) => {
  const slug = "banishing-light";
  const entry = await readEntry(workbench.cardsDir, slug);
  const disk = (): Promise<CardEntry> => readEntry(workbench.cardsDir, slug);
  await page.goto(`${workbench.url}#/card/${slug}`);

  await page.getByRole("button", { name: "prospect", exact: true }).click();
  await expect.poll(async () => (await disk()).status).toBe("prospect");

  await page.getByLabel("Section").selectOption("pirates");
  await expect.poll(async () => (await disk()).section).toBe("pirates");

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
  await page.getByRole("link", { name: "← all cards" }).click();
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
    .getByRole("list", { name: "Suggested tags" })
    .getByRole("button", { name: "+ Cantrip" })
    .click();
  await expect
    .poll(async () => (await disk()).tags)
    .toEqual([...before, "artifact-hate", "cantrip"]);
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
  await page.goto(workbench.url);

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

  const sections = async (): Promise<(string | undefined)[]> =>
    (await disk()).map((entry) => entry.section);
  await bar.getByRole("combobox", { name: "Move to section" }).selectOption("vampires");
  await bar.getByRole("button", { name: "Apply move to section" }).click();
  await expect.poll(sections).toEqual(["vampires", "vampires", "vampires"]);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(sections).toEqual(before.map((entry) => entry.section));

  await bar.getByRole("combobox", { name: "Move to section" }).selectOption("__none");
  await bar.getByRole("button", { name: "Apply move to section" }).click();
  await expect.poll(sections).toEqual([undefined, undefined, undefined]);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(sections).toEqual(before.map((entry) => entry.section));

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

test("the grid organizes by status, section, and tag kind", async ({ page, workbench }) => {
  const slug = "clarion-conqueror";
  const created = await page.request.post(`${workbench.url}api/tags`, {
    data: { label: "Pile test", kind: "archetype" },
  });
  expect(created.status()).toBe(200);
  const patched = await page.request.patch(`${workbench.url}api/cards`, {
    data: { changes: [{ slug, patch: { addTags: ["pile-test", "removal"], section: "pirates" } }] },
  });
  expect(patched.status()).toBe(200);
  await page.goto(workbench.url);
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

  await organize.selectOption("section");
  await expect(tile("pirates")).toBeVisible();

  await organize.selectOption("status");
  const draft = page.locator('[data-pile="draft"]');
  await draft.getByRole("checkbox", { name: "Select all in Draft" }).check();
  const count = await draft.locator(".tile").count();
  await expect(page.getByTestId("selected-count")).toHaveText(`${String(count)} selected`);
  await page.getByRole("button", { name: "Clear selection" }).click();

  await organize.selectOption("overview");
  await expect(page).not.toHaveURL(/by=/u);
});
