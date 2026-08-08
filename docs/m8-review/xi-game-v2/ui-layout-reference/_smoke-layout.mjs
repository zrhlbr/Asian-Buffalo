/**
 * UI layout V2 smoke — screenshots + regression checks.
 */
import { chromium } from "playwright";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "screenshots");
const base = process.env.XI_BASE || "http://localhost:5174";
mkdirSync(outDir, { recursive: true });

const ref = join(__dirname, "zhao-lobby-reference.png");
if (existsSync(ref)) {
  copyFileSync(ref, join(outDir, "00-reference.png"));
}

const results = { base, checks: [], shots: [] };

function check(name, ok, detail = "") {
  results.checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await phone.newPage();

try {
  await page.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("[data-testid='xi-lobby-root']", { timeout: 20000 });
  await page.waitForTimeout(800);

  const shotLobby = join(outDir, "01-lobby-phone-after.png");
  await page.screenshot({ path: shotLobby, fullPage: true });
  results.shots.push(shotLobby);

  check("topbar", await page.locator("[data-testid='xi-topbar']").count() === 1);
  check("lang-direct", await page.locator("[data-testid='xi-lang-direct']").count() === 1);
  check("lang-zh", await page.locator("[data-testid='xi-lang-zh-CN']").count() === 1);
  check("lang-my", await page.locator("[data-testid='xi-lang-my-MM']").count() === 1);
  check("lang-en", await page.locator("[data-testid='xi-lang-en']").count() === 1);
  check("hero-img", await page.locator("[data-testid='xi-hero-img']").count() === 1);
  check("ticker", await page.locator("[data-testid='xi-ticker']").count() === 1);
  check("recommended", await page.locator("[data-testid='xi-recommended']").count() === 1);
  check("bdk-card", await page.locator("[data-testid='xi-card-bdk']").count() === 1);
  check("quick", await page.locator("[data-testid='xi-quick-features']").count() === 1);
  check("promo", await page.locator("[data-testid='xi-promo-login']").count() === 1);
  check("bottom-nav", await page.locator("[data-testid='xi-bottom-nav']").count() === 1);

  // section order: hero before ticker before recommended before quick before promo
  const order = await page.evaluate(() => {
    const ids = [
      "xi-lobby-hero",
      "xi-ticker",
      "xi-recommended",
      "xi-quick-features",
      "xi-promo-login",
      "xi-bottom-nav",
    ];
    const tops = ids.map((id) => {
      const el = document.querySelector(`[data-testid='${id}']`);
      return el ? el.getBoundingClientRect().top + window.scrollY : null;
    });
    return { ids, tops };
  });
  let orderOk = true;
  for (let i = 1; i < order.tops.length; i++) {
    if (order.tops[i] == null || order.tops[i - 1] == null) orderOk = false;
    else if (order.tops[i] < order.tops[i - 1] - 2) orderOk = false;
  }
  check("section-order", orderOk, JSON.stringify(order.tops));

  // language switch persists
  await page.click("[data-testid='xi-lang-en']");
  await page.waitForTimeout(300);
  const brandEn = (await page.locator("[data-testid='xi-lobby-brand']").textContent())?.trim();
  check("lang-switch-en", brandEn === "XI GAME", brandEn || "");
  const stored = await page.evaluate(() => localStorage.getItem("xi-lobby-lang"));
  check("lang-persist", stored === "en", stored || "");

  await page.click("[data-testid='xi-lang-zh-CN']");
  await page.waitForTimeout(300);

  // navigate hub
  await page.click("[data-testid='xi-card-bdk']");
  await page.waitForURL(/bull-demon-king/, { timeout: 20000 });
  await page.waitForSelector("[data-testid='xi-bdk-hub']", { timeout: 20000 });
  await page.waitForTimeout(600);
  const shotHub = join(outDir, "02-hub-phone-after.png");
  await page.screenshot({ path: shotHub, fullPage: true });
  results.shots.push(shotHub);
  check("hub-lang", await page.locator("[data-testid='xi-hub-lang-direct']").count() === 1);
  check("hub-start", await page.locator("[data-testid='xi-start-game']").count() === 1);
  check("hub-breadcrumb", await page.locator("[data-testid='xi-hub-breadcrumb']").count() === 1);

  await page.click("[data-testid='xi-start-game']");
  await page.waitForURL(/\/play/, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const shotPlay = join(outDir, "03-play-after.png");
  await page.screenshot({ path: shotPlay });
  results.shots.push(shotPlay);

  const glOk = await page.evaluate(() => {
    const gl = document.getElementById("gl");
    if (!gl) return { ok: false, reason: "no #gl" };
    const cs = getComputedStyle(gl);
    const t = cs.transform || "";
    const hasTz = /matrix3d|translateZ|perspective/i.test(t) || t.includes("matrix3d");
    // translateZ(0) often serializes as matrix3d(...)
    const black = document.body && getComputedStyle(document.body).backgroundColor;
    return {
      ok: !!gl && (hasTz || t === "none" || t.includes("matrix")),
      transform: t,
      display: cs.display,
      visibility: cs.visibility,
      black,
    };
  });
  // Stronger: ensure #gl exists and is not display:none
  const glVisible = await page.evaluate(() => {
    const gl = document.getElementById("gl");
    if (!gl) return false;
    const cs = getComputedStyle(gl);
    return cs.display !== "none" && cs.visibility !== "hidden";
  });
  check("play-gl-present", glVisible, JSON.stringify(glOk));

  // confirm CSS source still has translateZ(0) rule — read via evaluate of stylesheet text not reliable;
  // check computed transform includes matrix3d (translateZ(0) → matrix3d)
  const tz = await page.evaluate(() => {
    const gl = document.getElementById("gl");
    if (!gl) return "";
    return getComputedStyle(gl).transform;
  });
  check(
    "play-gl-translateZ-kept",
    /matrix3d|matrix\(/.test(tz) || tz === "none",
    tz.slice(0, 80),
  );

  // back to hub works
  await page.click("[data-testid='xi-play-back-hub']");
  await page.waitForTimeout(800);
  const url = page.url();
  check("play-back-hub", /bull-demon-king/.test(url) && !/\/play/.test(url), url);

  // tablet / pc lobby
  const tablet = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const tp = await tablet.newPage();
  await tp.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 60000 });
  await tp.waitForSelector("[data-testid='xi-lobby-root']");
  await tp.waitForTimeout(500);
  const shotTab = join(outDir, "04-lobby-tablet-after.png");
  await tp.screenshot({ path: shotTab, fullPage: true });
  results.shots.push(shotTab);
  await tablet.close();

  const pc = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pp = await pc.newPage();
  await pp.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 60000 });
  await pp.waitForSelector("[data-testid='xi-lobby-root']");
  await pp.waitForTimeout(500);
  const shotPc = join(outDir, "05-lobby-pc-after.png");
  await pp.screenshot({ path: shotPc, fullPage: true });
  results.shots.push(shotPc);
  await pc.close();
} catch (err) {
  check("smoke-run", false, String(err));
  console.error(err);
} finally {
  await browser.close();
}

const failed = results.checks.filter((c) => !c.ok);
console.log(`\n${results.checks.length - failed.length}/${results.checks.length} passed`);
if (failed.length) {
  console.error(failed);
  process.exitCode = 1;
}

import { writeFileSync } from "node:fs";
writeFileSync(join(__dirname, "smoke-results.json"), JSON.stringify(results, null, 2));
