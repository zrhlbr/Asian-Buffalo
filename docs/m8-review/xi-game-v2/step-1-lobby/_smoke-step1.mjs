/**
 * Step 1 ONLY — `/xi` lobby + card → stub route + i18n.
 * Usage: node docs/m8-review/xi-game-v2/step-1-lobby/_smoke-step1.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://127.0.0.1:5173";
const outDir = join(__dirname, "screenshots");
mkdirSync(outDir, { recursive: true });

const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${detail}`);
}

async function dismiss(page) {
  await page.evaluate(() => {
    document.querySelector("#__vinext_dev_error_overlay_root")?.remove();
  }).catch(() => {});
}

const browser = await chromium.launch({ headless: true });

try {
  // Phone lobby
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const res = await page.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 20000 });
    await page.waitForSelector('[data-testid="xi-lobby-hero"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="xi-bottom-nav"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="xi-card-bdk"]', { timeout: 15000 });
    await page.waitForTimeout(700);
    await dismiss(page);
    await page.screenshot({ path: join(outDir, "01-lobby-phone.png"), fullPage: true });
    const featCount = await page.locator(".xi-feat-btn").count();
    const navCount = await page.locator(".xi-nav-btn").count();
    record(
      "lobby_phone",
      (res?.status() ?? 0) === 200 && featCount >= 8 && navCount === 5,
      `status=${res?.status()} feats=${featCount} nav=${navCount}`,
    );

    const href = await page.getAttribute('[data-testid="xi-card-bdk"]', "data-href");
    await page.click('[data-testid="xi-card-bdk"]');
    await page.waitForURL(/\/xi\/bull-demon-king\/?$/, { timeout: 20000 });
    await page.waitForSelector('[data-testid="xi-bdk-stub"]', { timeout: 15000 });
    const note = (await page.textContent('[data-testid="xi-stub-note"]')) || "";
    await page.waitForTimeout(400);
    await dismiss(page);
    await page.screenshot({ path: join(outDir, "02-stub-after-card.png"), fullPage: true });
    const path = new URL(page.url()).pathname.replace(/\/$/, "");
    record(
      "card_to_stub",
      href === "/xi/bull-demon-king" && path === "/xi/bull-demon-king" && note.length > 0,
      `href=${href} path=${path} noteLen=${note.length}`,
    );

    await page.click('[data-testid="xi-hub-back-lobby"]');
    await page.waitForURL(/\/xi\/?$/, { timeout: 15000 });
    record("stub_back_lobby", new URL(page.url()).pathname.replace(/\/$/, "") === "/xi", page.url());

    // play must NOT exist (Step 2 not started)
    const playRes = await page.goto(`${base}/xi/bull-demon-king/play`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const playStatus = playRes?.status() ?? 0;
    const playShell = await page.$('[data-testid="xi-bdk-play"]');
    record(
      "step2_not_started",
      playStatus >= 400 || !playShell,
      `playStatus=${playStatus} playShell=${!!playShell}`,
    );
    await page.close();
  }

  // Tablet + PC
  for (const [name, w, h] of [
    ["tablet", 768, 1024],
    ["pc", 1280, 800],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 20000 });
    await page.waitForTimeout(600);
    await dismiss(page);
    await page.screenshot({ path: join(outDir, `01-lobby-${name}.png`), fullPage: true });
    record(`lobby_${name}`, true, `${w}x${h}`);
    await page.close();
  }

  // i18n langs
  for (const lang of ["zh-CN", "en", "my-MM"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${base}/xi`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate((l) => localStorage.setItem("xi-lobby-lang", l), lang);
    await page.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('[data-testid="xi-lobby-brand"]', { timeout: 15000 });
    await page.waitForTimeout(500);
    await dismiss(page);
    const brand = ((await page.textContent('[data-testid="xi-lobby-brand"]')) || "").trim();
    const homeNav = ((await page.textContent('[data-testid="xi-nav-home"]')) || "").trim();
    await page.screenshot({ path: join(outDir, `lobby-${lang}.png`), fullPage: true });
    const expectBrand = lang === "zh-CN" ? "西游戏" : "XI GAME";
    const expectHome =
      lang === "zh-CN" ? "首页" : lang === "en" ? "Home" : "ပင်မ";
    record(
      `i18n_${lang}`,
      brand.includes(expectBrand) && homeNav.includes(expectHome),
      `brand="${brand}" home="${homeNav}"`,
    );
    await page.close();
  }

  // Slot regression smoke (must still load)
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const res = await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("#gl", { state: "attached", timeout: 20000 });
    await page.waitForTimeout(1000);
    const stack = await page.evaluate(() => {
      const hud = document.querySelector("#hud");
      return hud ? getComputedStyle(hud).transform : null;
    });
    await page.screenshot({ path: join(outDir, "03-slot-root-regression.png") });
    record(
      "slot_root_ok",
      (res?.status() ?? 0) === 200 && stack === "none",
      `status=${res?.status()} hudTransform=${stack}`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
writeFileSync(join(__dirname, "smoke-results.json"), JSON.stringify({ base, results, failed }, null, 2));
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ results }, null, 2));
