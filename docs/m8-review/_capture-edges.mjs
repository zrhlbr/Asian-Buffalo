/**
 * Edge / HUD close-ups for M8 P0 acceptance evidence.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.AB_CAPTURE_URL || "http://127.0.0.1:5173/";
const SHOTS = join(process.cwd(), "docs", "m8-review", "screenshots");
mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitBoot(page) {
  await page.waitForSelector("#btn-spin", { timeout: 60000 });
  await page.waitForFunction(() => {
    const loading = document.getElementById("loading");
    return !loading || loading.classList.contains("done");
  }, { timeout: 60000 });
  await sleep(1000);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const sizes = [
    { name: "edge-844x390", w: 844, h: 390 },
    { name: "edge-915x412", w: 915, h: 412 },
  ];
  for (const sz of sizes) {
    const context = await browser.newContext({
      viewport: { width: sz.w, height: sz.h },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitBoot(page);
    await page.screenshot({ path: join(SHOTS, `${sz.name}-full.png`) });
    // Left / right rail crops
    await page.screenshot({
      path: join(SHOTS, `${sz.name}-left.png`),
      clip: { x: 0, y: Math.floor(sz.h * 0.18), width: Math.floor(sz.w * 0.18), height: Math.floor(sz.h * 0.64) },
    });
    await page.screenshot({
      path: join(SHOTS, `${sz.name}-right.png`),
      clip: {
        x: Math.floor(sz.w * 0.82),
        y: Math.floor(sz.h * 0.18),
        width: Math.floor(sz.w * 0.18),
        height: Math.floor(sz.h * 0.64),
      },
    });
    await page.screenshot({
      path: join(SHOTS, `${sz.name}-hud-top.png`),
      clip: { x: 0, y: 0, width: sz.w, height: Math.min(90, sz.h) },
    });
    await page.screenshot({
      path: join(SHOTS, `${sz.name}-hud-bottom.png`),
      clip: { x: 0, y: Math.max(0, sz.h - 110), width: sz.w, height: Math.min(110, sz.h) },
    });
    console.log("EDGE", sz.name);
    await context.close();
  }

  // Big Win overlay capture + short video
  {
    const VIDEO = join(process.cwd(), "docs", "m8-review", "video");
    mkdirSync(VIDEO, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      recordVideo: { dir: VIDEO, size: { width: 844, height: 390 } },
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitBoot(page);
    await page.evaluate(() => {
      const el = document.getElementById("celebration");
      const tier = document.getElementById("celebration-tier");
      const amount = document.getElementById("celebration-amount");
      if (el && tier && amount) {
        el.classList.remove("hidden");
        el.classList.add("tier-big");
        tier.textContent = "BIG WIN";
        amount.textContent = "12,500";
      }
    });
    await sleep(800);
    await page.screenshot({ path: join(SHOTS, "08-phone-bigwin.png") });
    await sleep(1600);
    await context.close();
    console.log("BIGWIN");
  }

  await browser.close();
  console.log("DONE edges");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
