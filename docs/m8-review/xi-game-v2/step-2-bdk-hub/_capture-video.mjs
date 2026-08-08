import { mkdirSync, renameSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "screenshots");
mkdirSync(outDir, { recursive: true });
const base = process.argv[2] || "http://127.0.0.1:5173";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: outDir, size: { width: 390, height: 844 } },
  locale: "zh-CN",
});
const page = await context.newPage();
try {
  await page.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('[data-testid="xi-card-bdk"]');
  await page.click('[data-testid="xi-card-bdk"]');
  await page.waitForURL(/\/xi\/bull-demon-king\/?$/);
  await page.waitForSelector('[data-testid="xi-start-game"]');
  await page.waitForTimeout(700);
  await page.click('[data-testid="xi-start-game"]');
  await page.waitForURL(/\/play/);
  await page.waitForSelector("#gl", { state: "attached" });
  await page.waitForTimeout(1000);
  await page.goBack();
  await page.waitForURL(/\/xi\/bull-demon-king\/?$/);
  await page.waitForTimeout(600);
  await page.click('[data-testid="xi-hub-back-lobby"]');
  await page.waitForURL(/\/xi\/?$/);
  await page.waitForTimeout(600);
} finally {
  const vid = page.video();
  await context.close();
  await browser.close();
  if (vid) {
    const src = await vid.path();
    const dest = join(outDir, "enter-back-start-game.webm");
    if (existsSync(src)) renameSync(src, dest);
    console.log(dest);
  }
}
