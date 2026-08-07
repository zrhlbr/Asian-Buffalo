/**
 * Phase 2 capture: buffalo anim + big win video (browser evidence).
 * Not a substitute for Android/iPhone 真机录屏.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.AB_CAPTURE_URL || "http://127.0.0.1:5174/";
const OUT = join(process.cwd(), "docs", "m8-review");
const SHOTS = join(OUT, "screenshots");
const VIDEO = join(OUT, "video");
mkdirSync(SHOTS, { recursive: true });
mkdirSync(VIDEO, { recursive: true });
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

  // Buffalo animation sequence
  {
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
    await page.evaluate(async () => {
      const g = window.__game;
      const b = g?.buffalo || g?.game?.buffalo;
      if (!b) return;
      b.roar?.();
      await new Promise((r) => setTimeout(r, 1600));
      b.bigWin?.();
      await new Promise((r) => setTimeout(r, 2000));
      b.victory?.();
      await new Promise((r) => setTimeout(r, 2400));
    });
    await page.screenshot({ path: join(SHOTS, "p2-buffalo-pose.png") });
    await context.close();
    console.log("BUFFALO_VIDEO");
  }

  // Big Win overlay demo
  {
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
        amount.textContent = "18,000";
      }
      window.__game?.buffalo?.bigWin?.();
      window.__game?.world?.punchZoom?.(0.35);
      window.__game?.world?.shake?.(0.2, 5);
    });
    await sleep(2200);
    await page.screenshot({ path: join(SHOTS, "p2-bigwin.png") });
    await page.evaluate(() => {
      const el = document.getElementById("celebration");
      if (el) {
        el.classList.remove("tier-big");
        el.classList.add("tier-mega");
        document.getElementById("celebration-tier").textContent = "MEGA WIN";
      }
    });
    await sleep(1600);
    await context.close();
    console.log("BIGWIN_VIDEO");
  }

  // Symbol close-up via idle phone
  {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitBoot(page);
    await page.screenshot({ path: join(SHOTS, "p2-phone-landscape.png") });
    await page.screenshot({
      path: join(SHOTS, "p2-reel-edge-left.png"),
      clip: { x: 0, y: 60, width: 140, height: 260 },
    });
    await context.close();
  }

  await browser.close();
  console.log("DONE phase2 capture");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
