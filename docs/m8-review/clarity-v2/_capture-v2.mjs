/**
 * Clarity V2 after screenshots — requires local Vite on AB_CAPTURE_URL.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.AB_CAPTURE_URL || "http://127.0.0.1:5173/";
const SHOTS = join(HERE, "screenshots");
mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitBoot(page) {
  await page.waitForSelector("#btn-spin", { timeout: 60000 });
  await page
    .waitForFunction(() => {
      const loading = document.getElementById("loading");
      return !loading || loading.classList.contains("done");
    }, { timeout: 60000 })
    .catch(() => {});
  await sleep(1500);
}

async function main() {
  const result = { base: BASE, at: new Date().toISOString(), milestone: "clarity-v2", probes: {} };
  const browser = await chromium.launch({ headless: true });
  const views = [
    { name: "after-pc-idle", w: 1280, h: 720 },
    { name: "after-phone-landscape", w: 844, h: 390 },
    { name: "after-tablet-idle", w: 1024, h: 768 },
  ];
  try {
    for (const v of views) {
      const context = await browser.newContext({
        viewport: { width: v.w, height: v.h },
        deviceScaleFactor: v.w <= 900 ? 3 : 2,
      });
      const page = await context.newPage();
      await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
      await waitBoot(page);
      const probe = await page.evaluate(() => {
        const g = window.__game;
        if (g?.state) {
          const s = g.state();
          return s.clarity || s;
        }
        const c = document.querySelector("#gl");
        return {
          cssW: c?.clientWidth,
          cssH: c?.clientHeight,
          drawingBufferW: c?.width,
          drawingBufferH: c?.height,
        };
      }).catch(() => null);
      result.probes[v.name] = probe;
      await page.screenshot({
        path: join(SHOTS, `${v.name}.png`),
        fullPage: false,
      });
      console.log("SHOT", v.name, probe);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  writeFileSync(join(HERE, "capture-result.json"), JSON.stringify(result, null, 2));
  console.log("DONE", result.at);
}

main().catch((err) => {
  console.error("CAPTURE_FAILED", err);
  process.exit(1);
});
