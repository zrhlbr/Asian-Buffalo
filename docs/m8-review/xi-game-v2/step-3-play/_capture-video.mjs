/**
 * Short hub→play→spin→back video for Step 3 delivery.
 * Usage: node docs/m8-review/xi-game-v2/step-3-play/_capture-video.mjs [baseUrl]
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://127.0.0.1:5175";
const outDir = join(__dirname, "screenshots");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  recordVideo: { dir: outDir, size: { width: 844, height: 390 } },
});
const page = await context.newPage();

try {
  await page.goto(`${base}/xi/bull-demon-king`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('[data-testid="xi-start-game"]', { timeout: 20000 });
  await page.click('[data-testid="xi-start-game"]');
  await page.waitForURL(/\/play/, { timeout: 25000 });
  await page.waitForSelector("#btn-spin", { timeout: 40000 });
  await page.waitForTimeout(1200);
  await page.click("#btn-spin");
  await page.waitForTimeout(7000);
  await page.click('[data-testid="xi-play-back-hub"]');
  // If leave confirm (still busy), wait then leave
  const waitBtn = await page.$('[data-testid="xi-play-leave-wait"]');
  if (waitBtn) {
    await waitBtn.click();
    await page.waitForURL(/\/xi\/bull-demon-king\/?$/, { timeout: 35000 });
  } else {
    await page.waitForURL(/\/xi\/bull-demon-king\/?$/, { timeout: 20000 }).catch(() => {});
  }
  await page.waitForTimeout(800);
} finally {
  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();
  if (video) {
    const path = await video.path();
    const { renameSync } = await import("node:fs");
    const dest = join(outDir, "hub-play-spin-back.webm");
    try {
      renameSync(path, dest);
      console.log("VIDEO", dest);
    } catch {
      console.log("VIDEO_RAW", path);
    }
  }
}
