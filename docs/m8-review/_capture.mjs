/**
 * M8 commercial capture — PC / phone / tablet. Local DEV only.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.AB_CAPTURE_URL || "http://127.0.0.1:5173/";
const OUT = join(process.cwd(), "docs", "m8-review");
const SHOTS = join(OUT, "screenshots");
const VIDEO = join(OUT, "video");
const PERF = join(OUT, "perf");
for (const d of [SHOTS, VIDEO, PERF]) mkdirSync(d, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitBoot(page) {
  await page.waitForSelector("#btn-spin", { timeout: 45000 });
  await page.waitForFunction(() => {
    const loading = document.getElementById("loading");
    return !loading || loading.classList.contains("done");
  }, { timeout: 45000 });
  await page
    .waitForFunction(() => {
      const el = document.getElementById("balance");
      return el && el.textContent && el.textContent.trim() !== "0";
    }, { timeout: 20000 })
    .catch(() => {});
  await sleep(1200);
}

async function shot(page, name) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false });
  console.log("SHOT", name);
}

async function main() {
  const result = { base: BASE, at: new Date().toISOString(), milestone: "M8" };
  const browser = await chromium.launch({ headless: true });

  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: VIDEO, size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitBoot(page);
    await shot(page, "01-pc-idle");
    await page.click("#btn-spin").catch(() => {});
    await sleep(2400);
    await shot(page, "02-pc-spin");
    await page.evaluate(() => {
      const el = document.getElementById("celebration");
      const tier = document.getElementById("celebration-tier");
      const amount = document.getElementById("celebration-amount");
      if (el && tier && amount) {
        el.classList.remove("hidden");
        el.classList.add("tier-mega");
        tier.textContent = "MEGA WIN";
        amount.textContent = "25,000";
      }
    });
    await sleep(500);
    await shot(page, "03-pc-celebration");
    await context.close();
  }

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
    await shot(page, "04-phone-landscape-idle");
    await page.click("#btn-spin").catch(() => {});
    await sleep(2200);
    await shot(page, "05-phone-landscape-spin");
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitBoot(page);
    await shot(page, "06-tablet-idle");
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitBoot(page);
    await shot(page, "07-phone-portrait");
    await context.close();
  }

  writeFileSync(join(PERF, "capture-result.json"), JSON.stringify(result, null, 2));
  await browser.close();
  console.log("DONE", JSON.stringify(result));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
