/**
 * M8 P0 multi-size reel edge-fill probe (DEV + __game.test).
 * Records NDC rail positions + fill for required viewports.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.AB_CAPTURE_URL || "http://127.0.0.1:5173/";
const OUT = join(process.cwd(), "docs", "m8-review", "perf");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SIZES = [
  { name: "390x844-portrait", w: 390, h: 844, mobile: true },
  { name: "412x915-portrait", w: 412, h: 915, mobile: true },
  { name: "430x932-portrait", w: 430, h: 932, mobile: true },
  { name: "844x390-landscape", w: 844, h: 390, mobile: true },
  { name: "915x412-landscape", w: 915, h: 412, mobile: true },
  { name: "844x390-notch", w: 844, h: 390, mobile: true, notch: true },
  { name: "1280x720-pc", w: 1280, h: 720, mobile: false },
];

async function waitBoot(page) {
  await page.waitForSelector("#btn-spin", { timeout: 60000 });
  await page.waitForFunction(() => {
    const loading = document.getElementById("loading");
    return !loading || loading.classList.contains("done");
  }, { timeout: 60000 });
  await sleep(900);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const rows = [];

  for (const sz of SIZES) {
    const context = await browser.newContext({
      viewport: { width: sz.w, height: sz.h },
      isMobile: !!sz.mobile,
      hasTouch: !!sz.mobile,
      deviceScaleFactor: sz.mobile ? 2 : 1,
    });
    const page = await context.newPage();
    if (sz.notch) {
      await page.addInitScript(() => {
        const style = document.createElement("style");
        style.textContent = `
          :root {
            --safe-top: 0px;
            --safe-bottom: 0px;
          }
          html {
            padding-left: 44px !important;
            padding-right: 12px !important;
            box-sizing: border-box;
          }
        `;
        document.documentElement.appendChild(style);
      });
    }
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitBoot(page);
    // Force resize layout settle
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await sleep(400);

    const probe = await page.evaluate(() => {
      const g = window.__game;
      if (!g || typeof g.state !== "function") {
        return {
          ok: false,
          reason: "__game.state unavailable",
          keys: g ? Object.keys(g) : [],
        };
      }
      const t = g.state();
      const edge = t.edge || {};
      const leftPx = ((edge.leftNdc + 1) / 2) * window.innerWidth;
      const rightPx = ((edge.rightNdc + 1) / 2) * window.innerWidth;
      const leftGutter = leftPx;
      const rightGutter = window.innerWidth - rightPx;
      return {
        ok: true,
        className: document.getElementById("app")?.className || "",
        vw: window.innerWidth,
        vh: window.innerHeight,
        reelScale: t.reelScale,
        reelX: t.reelX,
        camZ: t.camZ,
        fov: t.fov,
        leftNdc: edge.leftNdc,
        rightNdc: edge.rightNdc,
        fill: edge.fill,
        leftGutterPx: Math.round(leftGutter * 10) / 10,
        rightGutterPx: Math.round(rightGutter * 10) / 10,
      };
    });

    const shortSide = Math.min(sz.w, sz.h);
    const phoneLandscape = sz.w > sz.h && shortSide <= 520;
    const phonePortrait = sz.h > sz.w && sz.w <= 500;
    const pass =
      probe.ok &&
      probe.reelX === 0 &&
      typeof probe.fill === "number" &&
      (phoneLandscape
        ? // P0: rails near edges, only necessary safe gutter
          probe.fill >= 0.96 &&
          probe.leftGutterPx >= -2 &&
          probe.leftGutterPx <= 24 &&
          probe.rightGutterPx >= -2 &&
          probe.rightGutterPx <= 24
        : phonePortrait
          ? probe.fill >= 0.88 &&
            probe.fill <= 0.985 &&
            probe.leftGutterPx >= -1 &&
            probe.rightGutterPx >= -1
          : // PC / tablet: centered board with breathing room is OK
            probe.fill >= 0.82 && probe.fill <= 0.96);

    rows.push({ ...sz, pass, phoneLandscape, phonePortrait, ...probe });
    console.log(
      sz.name,
      pass ? "PASS" : "FAIL",
      JSON.stringify({
        fill: probe.fill,
        leftGutterPx: probe.leftGutterPx,
        rightGutterPx: probe.rightGutterPx,
        scale: probe.reelScale,
        fov: probe.fov,
      }),
    );
    await context.close();
  }

  const out = {
    at: new Date().toISOString(),
    base: BASE,
    rows,
    phoneLandscapePass: rows.filter((r) => r.phoneLandscape).every((r) => r.pass),
    phonePortraitPass: rows.filter((r) => r.phonePortrait).every((r) => r.pass),
    landscapePass: rows.filter((r) => r.phoneLandscape).every((r) => r.pass),
  };
  writeFileSync(join(OUT, "fill-probe.json"), JSON.stringify(out, null, 2));
  await browser.close();
  console.log(
    "DONE phoneLandscapePass=",
    out.phoneLandscapePass,
    "phonePortraitPass=",
    out.phonePortraitPass,
  );
  if (!out.phoneLandscapePass) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
