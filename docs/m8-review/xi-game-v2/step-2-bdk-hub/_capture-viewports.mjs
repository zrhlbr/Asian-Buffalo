import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "screenshots");
mkdirSync(out, { recursive: true });
const base = process.argv[2] || "http://127.0.0.1:5173";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const langs = ["zh-CN", "en", "my-MM"];
const vps = [
  ["phone", 390, 844],
  ["tablet", 768, 1024],
  ["pc", 1440, 900],
];

for (const lang of langs) {
  for (const [name, w, h] of vps) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${base}/xi`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate((l) => localStorage.setItem("xi-lobby-lang", l), lang);
    await page.goto(`${base}/xi/bull-demon-king`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForSelector('[data-testid="xi-bdk-hub"]');
    await page.waitForTimeout(400);
    const file = join(out, `hub-${name}-${lang}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
}
await browser.close();
