/**
 * Minimal Phase 1 headed/headless smoke (Playwright via npx).
 * Usage: node docs/m8-review/xi-game-v2/phase-1/_smoke-lobby.mjs [baseUrl]
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://127.0.0.1:3000";
const outDir = join(__dirname, "screenshots");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const results = [];

async function check(path, testId, shotName) {
  const url = `${base}${path}`;
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  const status = res?.status() ?? 0;
  let ok = status >= 200 && status < 400;
  if (testId) {
    await page.waitForSelector(`[data-testid="${testId}"]`, { timeout: 15000 }).catch(() => {
      ok = false;
    });
    if (path === "/xi") {
      await page.waitForSelector(".xi-game-card, .xi-status-line", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  }
  if (path === "/" || path === "/game") {
    await page.waitForSelector("#gl", { timeout: 15000 }).catch(() => {
      ok = false;
    });
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: join(outDir, shotName), fullPage: true });
  results.push({ path, status, ok, shot: shotName });
  console.log(`${ok ? "PASS" : "FAIL"} ${path} status=${status}`);
}

try {
  await check("/xi", "xi-lobby-root", "01-lobby-phone.png");
  await check("/xi/bdk", "xi-bdk-hub", "02-bdk-hub-phone.png");
  await check("/", null, "03-slot-root.png");
  await check("/game", null, "04-slot-game-alias.png");
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(JSON.stringify({ results, failed }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ results }, null, 2));
