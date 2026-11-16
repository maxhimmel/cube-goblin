import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export interface HostUnderTest {
  page: Page;
  cardsDir: string;
  cubesHome: string;
  relaunch: () => Promise<Page>;
}

export async function notes(cardsDir: string, slug: string): Promise<unknown> {
  const entry: unknown = JSON.parse(await readFile(join(cardsDir, `${slug}.json`), "utf8"));
  return typeof entry === "object" && entry !== null && "notes" in entry ? entry.notes : undefined;
}

export async function switcher(page: Page): Promise<Locator> {
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

export async function twoCubes(host: HostUnderTest): Promise<void> {
  let page = host.page;
  const brand = (): Locator => page.locator(".brand");
  const tiles = (): Locator => page.locator(".lab-image img");
  await expect(brand()).toHaveText("Max's Cube");
  await page.evaluate(() => {
    window.location.hash = "#/card/abrade";
  });
  await page.getByLabel("Notes").fill("only in the first cube");
  await page.getByLabel("Notes").blur();
  await expect.poll(() => notes(host.cardsDir, "abrade")).toBe("only in the first cube");
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
  const secondConfig: unknown = JSON.parse(
    await readFile(join(host.cubesHome, "second-cube", "cube.config.json"), "utf8"),
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
  page = await host.relaunch();
  await expect(brand()).toHaveText("Second Cube");

  const recents = await switcher(page);
  await recents.getByRole("button", { name: "Remove Max's Cube from the list" }).click();
  await expect(recents.getByRole("button", { name: "Max's Cube", exact: true })).toHaveCount(0);
  expect(await notes(host.cardsDir, "abrade")).toBe("only in the first cube");
}

export async function makeAvailableOffline(page: Page): Promise<void> {
  const menu = await switcher(page);
  const current = menu.locator(".cube-recent[data-current='true']");
  const make = current.getByRole("button", { name: "Make available offline" });
  await expect(current.getByText(/Available offline · |cards saved offline · /u)).toBeVisible();
  if (await make.isVisible()) {
    await make.click();
  }
  await expect(current.getByText(/^Available offline · /u)).toBeVisible({ timeout: 280_000 });
  await page.keyboard.press("Escape");
}

export async function importIntoNewCube(host: HostUnderTest): Promise<void> {
  const { page } = host;
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
  const cards = join(host.cubesHome, "bolts", "cards");
  const bolt: unknown = JSON.parse(await readFile(join(cards, "lightning-bolt.json"), "utf8"));
  const shock: unknown = JSON.parse(await readFile(join(cards, "shock.json"), "utf8"));
  expect(bolt).toMatchObject({ status: "draft" });
  expect(shock).toMatchObject({ status: "prospect" });
  expect(await notes(host.cardsDir, "shock")).toBe("");
}
