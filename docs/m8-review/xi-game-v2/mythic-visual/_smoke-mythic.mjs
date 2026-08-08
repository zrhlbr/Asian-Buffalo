/**
 * Mythic visual smoke + screenshots (Playwright).
 * Usage: node docs/m8-review/xi-game-v2/mythic-visual/_smoke-mythic.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
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

async function shot(path, opts = {}) {
  const url = `${base}${path}`;
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  const status = res?.status() ?? 0;
  let ok = status >= 200 && status < 400;
  if (opts.testId) {
    await page.waitForSelector(`[data-testid="${opts.testId}"]`, { timeout: 15000 }).catch(() => {
      ok = false;
    });
  }
  if (opts.wait) await page.waitForTimeout(opts.wait);
  if (opts.lang) {
    await page.evaluate((lang) => {
      localStorage.setItem("xi-lobby-lang", lang);
    }, opts.lang);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);
  }
  if (path === "/" || path === "/game") {
    await page.waitForSelector("#gl", { timeout: 15000 }).catch(() => {
      ok = false;
    });
    const stacking = await page.evaluate(() => {
      const gl = document.querySelector("#gl");
      const hud = document.querySelector("#hud");
      if (!gl || !hud) return { ok: false };
      const glT = getComputedStyle(gl).transform;
      const hudT = getComputedStyle(hud).transform;
      return {
        ok: glT.includes("matrix") || glT !== "none",
        glTransform: glT,
        hudTransform: hudT,
        hudIsNone: hudT === "none",
        hasChrome: !!document.querySelector("#xi-mythic-chrome"),
      };
    });
    ok = ok && stacking.ok && stacking.hudIsNone && stacking.hasChrome;
    results.push({ path, status, ok, stacking, shot: opts.shot });
  } else {
    results.push({ path, status, ok, shot: opts.shot });
  }
  await page.screenshot({ path: join(outDir, opts.shot), fullPage: true });
  console.log(`${ok ? "PASS" : "FAIL"} ${path} → ${opts.shot}`);
}

try {
  await shot("/xi", { testId: "xi-lobby-root", wait: 1000, shot: "01-lobby-phone.png" });
  await shot("/xi", { testId: "xi-lobby-root", lang: "en", wait: 400, shot: "06-lobby-en.png" });
  await shot("/xi", { testId: "xi-lobby-root", lang: "my-MM", wait: 400, shot: "07-lobby-my.png" });
  await shot("/xi", { testId: "xi-lobby-root", lang: "zh-CN", wait: 400, shot: "05-lobby-zh.png" });
  await shot("/xi/bdk", { testId: "xi-bdk-hub", wait: 1200, shot: "02-bdk-hub-phone.png" });
  await shot("/", { wait: 1500, shot: "03-slot-root.png" });
  await shot("/game", { wait: 1500, shot: "04-slot-game.png" });

  page.setViewportSize({ width: 1280, height: 800 });
  await shot("/xi", { testId: "xi-lobby-root", wait: 800, shot: "01b-lobby-pc.png" });
} finally {
  await browser.close();
}

writeFileSync(join(__dirname, "smoke-results.json"), JSON.stringify({ results }, null, 2));
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ results }, null, 2));
