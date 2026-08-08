/**
 * Step 5 headed smoke — lobby brand + deposit NOT_PRODUCTION_READY banner.
 * Does not invent PASS for physical devices.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AB_SMOKE_BASE || "http://127.0.0.1:3000";
const OUT = path.resolve("docs/m8-review/xi-game-v2/step-5-finalize");
const shots = path.join(OUT, "screenshots");
fs.mkdirSync(shots, { recursive: true });

const results = [];
function rec(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}: ${detail}`);
}

let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
} catch {
  try {
    browser = await chromium.launch({ headless: true, channel: "msedge" });
  } catch (err) {
    rec("browser.launch", false, String(err));
    fs.writeFileSync(path.join(OUT, "smoke-results.json"), JSON.stringify({ base: BASE, results }, null, 2));
    process.exit(1);
  }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
try {
  const home = await page.goto(`${BASE}/xi`, { waitUntil: "domcontentloaded", timeout: 30000 });
  rec("lobby.navigate", home?.ok() ?? false, `status=${home?.status()}`);
  await page.waitForTimeout(800);
  const brand = await page.locator('[data-testid="xi-lobby-root"]').innerText().catch(() => "");
  rec("lobby.brand", brand.includes("西游戏") || brand.includes("XI GAME"), brand.slice(0, 80));
  await page.screenshot({ path: path.join(shots, "01-lobby-pc.png"), fullPage: true });

  const recharge = page.locator('[data-testid="xi-lobby-recharge"], button:has-text("充值"), button:has-text("Top up")').first();
  if (await recharge.count()) {
    await recharge.click();
    await page.waitForTimeout(600);
    const banner = page.locator('[data-testid="xi-deposit-not-prod"]');
    const hasBanner = (await banner.count()) > 0;
    const text = hasBanner ? await banner.innerText() : "";
    rec("deposit.not_prod_banner", hasBanner && text.includes("NOT_PRODUCTION_READY"), text.slice(0, 120));
    await page.screenshot({ path: path.join(shots, "02-deposit-not-prod.png") });
  } else {
    rec("deposit.not_prod_banner", false, "recharge entry not found");
  }

  const hub = await page.goto(`${BASE}/xi/bull-demon-king`, { waitUntil: "domcontentloaded", timeout: 30000 });
  rec("hub.navigate", hub?.ok() ?? false, `status=${hub?.status()}`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shots, "03-hub-pc.png"), fullPage: true });
} catch (err) {
  rec("smoke.exception", false, String(err));
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, "smoke-results.json"), JSON.stringify({ base: BASE, results }, null, 2));
const failed = results.filter((r) => !r.ok);
process.exit(failed.length ? 1 : 0);
