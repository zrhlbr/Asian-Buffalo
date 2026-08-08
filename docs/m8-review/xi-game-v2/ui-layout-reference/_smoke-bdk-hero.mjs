import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "screenshots");
mkdirSync(dir, { recursive: true });
const base = process.env.XI_BASE || "http://localhost:5174";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
await page.goto(`${base}/xi/bull-demon-king`, {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForSelector("[data-testid='xi-hub-hero-img']", { timeout: 20000 });
await page.waitForTimeout(900);
const src = await page.getAttribute("[data-testid='xi-hub-hero-img']", "src");
const gap = await page.locator("[data-testid='xi-hub-asset-gap']").count();
const natural = await page.evaluate(() => {
  const img = document.querySelector("[data-testid='xi-hub-hero-img']");
  if (!(img instanceof HTMLImageElement)) return null;
  return {
    complete: img.complete,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    fit: getComputedStyle(img).objectFit,
  };
});
console.log(JSON.stringify({ src, gap, natural }, null, 2));
if (!src?.includes("/xi/heroes/bull-demon-king.png")) {
  console.error("FAIL: wrong hero src");
  process.exitCode = 1;
}
if (gap !== 0) {
  console.error("FAIL: ASSET_GAP still visible");
  process.exitCode = 1;
}
if (!natural?.complete || natural.naturalWidth < 100) {
  console.error("FAIL: hero image not loaded");
  process.exitCode = 1;
}
await page.screenshot({
  path: join(dir, "02-hub-phone-after.png"),
  fullPage: true,
});
await page.screenshot({
  path: join(dir, "02-hub-bdk-hero-official.png"),
  fullPage: true,
});

const tablet = await browser.newContext({
  viewport: { width: 768, height: 1024 },
});
const tp = await tablet.newPage();
await tp.goto(`${base}/xi/bull-demon-king`, {
  waitUntil: "networkidle",
  timeout: 60000,
});
await tp.waitForSelector("[data-testid='xi-hub-hero-img']");
await tp.waitForTimeout(600);
await tp.screenshot({
  path: join(dir, "02-hub-tablet-bdk-hero.png"),
  fullPage: true,
});
await tablet.close();
await browser.close();
console.log("shots ok");
