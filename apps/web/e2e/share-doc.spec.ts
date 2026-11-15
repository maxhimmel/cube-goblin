import { readFile, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { extractReview, parseMessage, reviewSchema, tagCounts } from "@repo/cube/browser";
import lzString from "lz-string";
import snapshot from "../src/generated/snapshot.json" with { type: "json" };

const DIST = fileURLToPath(new URL("../dist/index.html", import.meta.url));
const DOC_URL = pathToFileURL(DIST).href;
const FIRST = snapshot.cards[0];

async function openReview(page: Page): Promise<void> {
  const trigger = page.getByRole("button", { name: /^Review/u });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
}

test("share doc is one self-contained file", async () => {
  const html = await readFile(DIST, "utf8");
  expect(html).not.toMatch(/<script[^>]+src=/u);
  expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/u);
  expect(html).not.toContain("/api/cube");
  expect(new Set(html.match(/data:font\/[a-z0-9+-]+/gu))).toEqual(new Set(["data:font/woff2"]));
  const { size } = await stat(DIST);
  console.log(`dist/index.html: ${(size / 1024 / 1024).toFixed(2)} MB`);
});

test("friend reviews from file://, saves a copy, and the copy carries the review", async ({
  page,
  browser,
}, testInfo) => {
  if (!FIRST) {
    throw new Error("empty snapshot");
  }
  await page.goto(`${DOC_URL}#/cards`);
  await page.getByRole("checkbox", { name: "Show cut" }).check();
  await expect(page.locator(".lab-image img")).toHaveCount(snapshot.cards.length);

  await openReview(page);
  await page.getByLabel("Your name").fill("Sam");
  await page.locator(`.lab-image:has(img[alt=${JSON.stringify(FIRST.name)}])`).click();
  await expect(page).toHaveURL(new RegExp(`#/\\?card=${FIRST.slug}$`, "u"));
  await expect(page.getByRole("heading", { name: FIRST.name })).toBeVisible();

  await page.getByRole("button", { name: "cut" }).click();
  await page.getByLabel("Comment").fill("Too swingy for 2-player </script> imo");

  await page.reload();
  await expect(page.getByLabel("Comment")).toHaveValue("Too swingy for 2-player </script> imo");
  await expect(page.getByRole("button", { name: "cut" })).toHaveAttribute("aria-pressed", "true");

  await openReview(page);
  await page.getByRole("button", { name: "Copy review code" }).click();
  const code = await page.getByLabel("Review code").inputValue();
  const decoded = reviewSchema.parse(JSON.parse(lzString.decompressFromEncodedURIComponent(code)));
  expect(decoded.reviewer).toBe("Sam");
  expect(decoded.cards[FIRST.slug]?.vote).toBe("cut");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save copy to send back" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("maxs-cube-sam.html");
  const savedPath = testInfo.outputPath("saved.html");
  await download.saveAs(savedPath);

  const saved = await readFile(savedPath, "utf8");
  const embedded = extractReview(saved);
  expect(embedded?.cards[FIRST.slug]?.comment).toBe("Too swingy for 2-player </script> imo");
  expect(saved).not.toContain('<div id="root"><div');

  const fresh = await browser.newContext();
  const reopened = await fresh.newPage();
  await reopened.goto(`${pathToFileURL(savedPath).href}#/card/${FIRST.slug}`);
  await expect(reopened.getByLabel("Comment")).toHaveValue("Too swingy for 2-player </script> imo");
  await openReview(reopened);
  await expect(reopened.getByLabel("Your name")).toHaveValue("Sam");
  await fresh.close();
});

test("share doc shows insights from the snapshot", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${DOC_URL}#/insights`);
  await expect(page.getByRole("img", { name: "Color by mana value" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Combat matchups" })).toBeVisible();
  await expect(page.getByTestId("stat-creatures").locator(".stat-value")).toHaveText(/^\d+$/u);
  await expect(page.getByLabel("Count cards in").locator("option")).toHaveText([
    "Draft",
    "Draft + prospects",
    "All cards",
  ]);
  const heat = page.getByRole("region", { name: "Color by mana value" });
  await heat.getByRole("button", { name: "Table" }).click();
  const row = heat
    .locator("tbody tr")
    .filter({ hasNot: page.locator('td:text-is("0")') })
    .first();
  const count = Number(await row.locator("td").textContent());
  await row.getByRole("button").click();
  await expect(
    page.getByRole("complementary", { name: "Cards in bucket" }).locator(".strip"),
  ).toHaveCount(count);
  expect(errors).toEqual([]);
});

test("share doc shows tag overlaps from the snapshot", async ({ page }) => {
  const considered = snapshot.cards.filter((card) => card.status !== "cut");
  const counts = tagCounts(considered);
  const [first, second] = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  if (first === undefined || second === undefined) {
    throw new Error("the snapshot needs two tags");
  }
  const both = considered.filter(
    (card) => card.tags.includes(first) && card.tags.includes(second),
  ).length;
  await page.goto(`${DOC_URL}#/tags?tags=${first},${second}`);
  const venn = page.getByRole("img", { name: /^Venn diagram/u });
  await expect(venn.locator('[data-key="0+1"]')).toHaveText(String(both));
  const numbers = await page.locator(".overlap-number").allTextContents();
  expect(numbers.reduce((sum, value) => sum + Number(value), 0)).toBe(considered.length);
});

test("share doc keeps view choices across views and reloads", async ({ page }) => {
  await page.goto(`${DOC_URL}#/insights`);
  await page.getByLabel("Count cards in").selectOption("all");
  const views = page.getByRole("navigation", { name: "Views" });
  await views.getByRole("link", { name: "Forge", exact: true }).click();
  const cardType = page.getByRole("group", { name: "Group by" }).getByRole("button", {
    name: "Card type",
  });
  await cardType.click();
  await page.reload();
  await views.getByRole("link", { name: "Insights", exact: true }).click();
  await expect(page.getByLabel("Count cards in")).toHaveValue("all");
  await views.getByRole("link", { name: "Forge", exact: true }).click();
  await expect(cardType).toHaveAttribute("aria-pressed", "true");
});

test("share doc shows the change log read-only with its timeline", async ({ page }) => {
  const [latest] = [...snapshot.log].reverse();
  if (!latest) {
    throw new Error("the snapshot needs a log entry");
  }
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(DOC_URL);
  await page
    .getByRole("navigation", { name: "Views" })
    .getByRole("link", { name: "History", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  const entries = page.getByTestId("log-entry");
  await expect(entries).toHaveCount(snapshot.log.length);
  const { subject, body } = parseMessage(latest.message);
  const entry = page.locator(`#log-entry-${latest.id}`);
  await expect(entry.locator(".log-subject")).toHaveText(subject);
  if (body !== "") {
    await expect(entry.locator(".log-body")).toHaveCount(0);
    await entry.locator(".log-subject").click();
    await expect(entry.locator(".log-body")).toHaveText(body);
  }
  await expect(page.getByRole("button", { name: /^Revert/u })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /^Select /u })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Stats timeline" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("share doc keeps a filter block's view and table toggle across reloads", async ({ page }) => {
  const [filter] = snapshot.filters;
  if (!filter) {
    throw new Error("the snapshot needs a saved filter");
  }
  const next = filter.view === "heat" ? "pt" : "heat";
  await page.goto(`${DOC_URL}#/insights`);
  const block = page.getByRole("region", { name: filter.label, exact: true });
  await block.getByLabel(`Show ${filter.label} as`).selectOption(next);
  await block.getByRole("button", { name: "Table" }).click();
  await page.reload();
  await expect(block.getByLabel(`Show ${filter.label} as`)).toHaveValue(next);
  await expect(block.getByRole("button", { name: "Table" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("share doc carries its favicon inline and it renders", async ({ page }) => {
  await page.goto(`${DOC_URL}#/cards`);
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute("href", /^data:image\/svg\+xml,/u);
  const size = await icon.evaluate(async (link) => {
    const image = new Image();
    image.src = (link as HTMLLinkElement).href;
    await image.decode();
    return image.naturalWidth;
  });
  expect(size).toBeGreaterThan(0);
});

test("a reviewer's pending moves travel in the review code and the saved copy", async ({
  page,
  browser,
}, testInfo) => {
  const card = snapshot.cards.find((candidate) => candidate.status === "draft");
  if (!card) {
    throw new Error("the snapshot needs a draft card");
  }
  await page.goto(DOC_URL);
  await openReview(page);
  await page.getByLabel("Your name").fill("Sam");
  await page
    .locator(".lab-strip")
    .filter({ hasText: card.name })
    .first()
    .click({ modifiers: ["Alt"] });
  await openReview(page);
  await expect(page.getByTestId("moves-count")).toHaveText("1 move");
  await page.reload();
  await openReview(page);
  await expect(page.getByTestId("moves-count")).toHaveText("1 move");

  await page.getByRole("button", { name: "Copy review code" }).click();
  const code = await page.getByLabel("Review code").inputValue();
  const decoded = reviewSchema.parse(JSON.parse(lzString.decompressFromEncodedURIComponent(code)));
  expect(decoded.moves).toEqual([{ slug: card.slug, to: "prospect" }]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save copy to send back" }).click();
  const savedPath = testInfo.outputPath("saved.html");
  await (await downloadPromise).saveAs(savedPath);
  expect(extractReview(await readFile(savedPath, "utf8"))?.moves).toEqual(decoded.moves);

  const fresh = await browser.newContext();
  const reopened = await fresh.newPage();
  await reopened.goto(pathToFileURL(savedPath).href);
  await openReview(reopened);
  await expect(reopened.getByTestId("moves-count")).toHaveText("1 move");
  await fresh.close();
});

test("share doc keeps its own state apart from other copies in the same browser", async ({
  page,
}) => {
  const card = snapshot.cards.find((candidate) => candidate.status === "draft");
  if (!card) {
    throw new Error("the snapshot needs a draft card");
  }
  await page.goto(DOC_URL);
  await page.evaluate((slug) => {
    localStorage.setItem(
      "cube:view-state:v1",
      JSON.stringify({ "pending.lab": [{ slug, to: "prospect" }], "lab.axis": "type" }),
    );
  }, card.slug);
  await page.reload();
  await openReview(page);
  await expect(page.getByTestId("moves-count")).toHaveText("0 moves");
  await expect(
    page.getByRole("group", { name: "Group by" }).getByRole("button", { name: "Card type" }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("share doc reviewers can change Forge settings", async ({ page }) => {
  await page.goto(DOC_URL);
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  const baseline = settings.getByLabel("Faint baseline under filtered charts");
  await expect(baseline).toBeChecked();
  await baseline.uncheck();
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(baseline).not.toBeChecked();
});
