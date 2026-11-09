import { readFile, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { extractReview, reviewSchema } from "@repo/cube/browser";
import lzString from "lz-string";
import snapshot from "../src/generated/snapshot.json" with { type: "json" };

const DIST = fileURLToPath(new URL("../dist/index.html", import.meta.url));
const DOC_URL = pathToFileURL(DIST).href;
const FIRST = snapshot.cards[0];

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
  await page.goto(DOC_URL);
  await expect(page.locator(".grid img")).toHaveCount(snapshot.cards.length);

  await page.getByLabel("Your name").fill("Sam");
  await page.locator(".grid a").first().click();
  await expect(page).toHaveURL(new RegExp(`#/card/${FIRST.slug}$`, "u"));
  await expect(page.getByRole("heading", { name: FIRST.name })).toBeVisible();

  await page.getByRole("button", { name: "cut" }).click();
  await page.getByLabel("Comment").fill("Too swingy for 2-player </script> imo");

  await page.reload();
  await expect(page.getByLabel("Comment")).toHaveValue("Too swingy for 2-player </script> imo");
  await expect(page.getByRole("button", { name: "cut" })).toHaveAttribute("aria-pressed", "true");

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
  await expect(reopened.getByLabel("Your name")).toHaveValue("Sam");
  await fresh.close();
});
