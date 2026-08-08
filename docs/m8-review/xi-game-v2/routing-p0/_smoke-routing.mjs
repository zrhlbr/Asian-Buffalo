/**
 * Routing P0 E2E — scenarios 1–7 + i18n title/start/back keys.
 * Usage: node docs/m8-review/xi-game-v2/routing-p0/_smoke-routing.mjs [baseUrl]
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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "zh-CN",
});
const page = await context.newPage();

async function dismissDevOverlay() {
  await page.evaluate(() => {
    document.querySelector("#__vinext_dev_error_overlay_root")?.remove();
    document.querySelector("[data-testid='vinext-dev-error-message']")?.closest("div")?.remove();
  }).catch(() => {});
}

async function shot(name) {
  await dismissDevOverlay();
  await page.screenshot({ path: join(outDir, name), fullPage: true });
}

try {
  // --- S1: /xi lobby exists ---
  {
    const res = await page.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 60000 });
    const status = res?.status() ?? 0;
    const root = await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 20000 }).catch(() => null);
    await page.waitForSelector(".xi-game-card, .xi-status-line", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
    await shot("01-lobby-zh.png");
    record("S1_lobby", status === 200 && !!root, `status=${status} root=${!!root} url=${page.url()}`);
  }

  // --- S2: BDK card → hub (not play) ---
  {
    const card = await page.waitForSelector('[data-testid="xi-card-bdk"]', { timeout: 15000 }).catch(() => null);
    const href = card ? await card.getAttribute("data-href") : null;
    if (card) await card.click();
    await page.waitForURL(/\/xi\/bull-demon-king\/?$/, { timeout: 20000 }).catch(() => {});
    await page.waitForSelector('[data-testid="xi-bdk-hub"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    await shot("02-hub-zh.png");
    const url = new URL(page.url());
    const ok =
      !!card &&
      href === "/xi/bull-demon-king" &&
      url.pathname.replace(/\/$/, "") === "/xi/bull-demon-king" &&
      !url.pathname.includes("/play");
    record("S2_card_to_hub", ok, `href=${href} url=${url.pathname}`);
  }

  // --- S3: Start game → play ---
  {
    const cta = await page.waitForSelector('[data-testid="xi-start-game"]', { timeout: 15000 }).catch(() => null);
    if (cta) await cta.click();
    await page.waitForURL(/\/xi\/bull-demon-king\/play\/?$/, { timeout: 25000 }).catch(() => {});
    const play = await page.waitForSelector('[data-testid="xi-bdk-play"]', { timeout: 20000 }).catch(() => null);
    const gl = await page.waitForSelector("#gl", { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(1400);
    await shot("03-play-zh.png");
    const path = new URL(page.url()).pathname.replace(/\/$/, "");
    record("S3_start_to_play", !!cta && !!play && !!gl && path === "/xi/bull-demon-king/play", `path=${path} play=${!!play} gl=${!!gl}`);
  }

  // --- S4: Play back → hub ---
  {
    const back = await page.waitForSelector('[data-testid="xi-play-back-hub"]', { timeout: 10000 }).catch(() => null);
    if (back) await back.click();
    await page.waitForURL(/\/xi\/bull-demon-king\/?$/, { timeout: 20000 }).catch(() => {});
    const hub = await page.waitForSelector('[data-testid="xi-bdk-hub"]', { timeout: 15000 }).catch(() => null);
    const path = new URL(page.url()).pathname.replace(/\/$/, "");
    record("S4_play_back_hub", !!back && !!hub && path === "/xi/bull-demon-king", `path=${path}`);
  }

  // --- S5: Hub back → lobby ---
  {
    const back = await page.waitForSelector('[data-testid="xi-hub-back-lobby"]', { timeout: 10000 }).catch(() => null);
    if (back) await back.click();
    await page.waitForURL(/\/xi\/?$/, { timeout: 20000 }).catch(() => {});
    const lobby = await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 15000 }).catch(() => null);
    const path = new URL(page.url()).pathname.replace(/\/$/, "");
    record("S5_hub_back_lobby", !!back && !!lobby && path === "/xi", `path=${path}`);
  }

  // --- S6: Browser back chain play→hub→lobby ---
  {
    await page.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('[data-testid="xi-card-bdk"]', { timeout: 15000 });
    await page.click('[data-testid="xi-card-bdk"]');
    await page.waitForURL(/\/xi\/bull-demon-king\/?$/, { timeout: 20000 });
    await page.click('[data-testid="xi-start-game"]');
    await page.waitForURL(/\/play/, { timeout: 25000 });
    await page.waitForSelector("#gl", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.goBack();
    await page.waitForTimeout(800);
    const after1 = new URL(page.url()).pathname.replace(/\/$/, "");
    const hubOk = after1 === "/xi/bull-demon-king";
    await page.goBack();
    await page.waitForTimeout(800);
    const after2 = new URL(page.url()).pathname.replace(/\/$/, "");
    const lobbyOk = after2 === "/xi";
    record("S6_browser_back_chain", hubOk && lobbyOk, `afterPlayBack=${after1} afterHubBack=${after2}`);
  }

  // --- S7: Legacy /xi/bdk → hub ---
  {
    const res = await page.goto(`${base}/xi/bdk`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(500);
    const path = new URL(page.url()).pathname.replace(/\/$/, "");
    const hub = await page.$('[data-testid="xi-bdk-hub"]');
    const status = res?.status() ?? 0;
    const redirected = path === "/xi/bull-demon-king";
    record("S7_legacy_bdk_redirect", redirected && !!hub, `final=${path} status=${status}`);
  }

  // --- i18n keys zh/en/my via localStorage + hub/play labels ---
  for (const lang of ["zh-CN", "en", "my-MM"]) {
    await page.goto(`${base}/xi`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate((l) => localStorage.setItem("xi-lobby-lang", l), lang);
    await page.goto(`${base}/xi/bull-demon-king`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('[data-testid="xi-start-game"]', { timeout: 15000 });
    await page.waitForTimeout(400);
    await dismissDevOverlay();
    const expectStart =
      lang === "zh-CN" ? "开始游戏" : lang === "en" ? "Start game" : "ဂိမ်းစတင်မည်";
    await page.waitForFunction(
      (text) => (document.querySelector('[data-testid="xi-start-game"]')?.textContent || "").includes(text),
      expectStart,
      { timeout: 8000 },
    ).catch(() => {});
    const startText = (await page.textContent('[data-testid="xi-start-game"]'))?.trim() ?? "";
    const backXi = (await page.textContent('[data-testid="xi-hub-back-lobby"]'))?.trim() ?? "";
    const title = (await page.textContent('[data-testid="xi-hub-title"]'))?.trim() ?? "";
    await shot(`hub-${lang}.png`);
    await dismissDevOverlay();
    await page.click('[data-testid="xi-start-game"]', { force: true });
    await page.waitForURL(/\/play/, { timeout: 25000 }).catch(() => {});
    await page.waitForSelector('[data-testid="xi-play-back-hub"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    await dismissDevOverlay();
    const backHub = (await page.textContent('[data-testid="xi-play-back-hub"]'))?.trim() ?? "";
    await page.waitForTimeout(900);
    await shot(`play-${lang}.png`);
    const expectBackXi =
      lang === "zh-CN" ? "返回西游戏" : lang === "en" ? "Back to XI GAME" : "XI GAME သို့ ပြန်ရန်";
    const expectBackHub =
      lang === "zh-CN"
        ? "返回牛魔王首页"
        : lang === "en"
          ? "Back to Bull Demon King home"
          : "နွားနတ်ဆိုးဘုရင် ပင်မသို့";
    const ok =
      startText.includes(expectStart) &&
      backXi.includes(expectBackXi) &&
      backHub.includes(expectBackHub) &&
      title.length > 0;
    record(`I18N_${lang}`, ok, `start="${startText}" backXi="${backXi}" backHub="${backHub}" title="${title}"`);
  }

  // stacking sanity on play (#gl may be opacity-hidden briefly; attach is enough)
  {
    await page.goto(`${base}/xi/bull-demon-king/play`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("#gl", { state: "attached", timeout: 20000 });
    await page.waitForSelector("#hud", { state: "attached", timeout: 20000 });
    await page.waitForTimeout(1200);
    const stack = await page.evaluate(() => {
      const glEl = document.querySelector("#gl");
      const hudEl = document.querySelector("#hud");
      const gl = glEl ? getComputedStyle(glEl) : null;
      const hud = hudEl ? getComputedStyle(hudEl) : null;
      return {
        hasGl: !!glEl,
        hasHud: !!hudEl,
        glTransform: gl?.transform ?? null,
        hudTransform: hud?.transform ?? null,
      };
    });
    const glOk =
      stack.hasGl &&
      (String(stack.glTransform).includes("matrix") || stack.glTransform === "none" || !!stack.glTransform);
    // P0: #hud shell must NOT use translateZ stacking
    const hudOk = stack.hasHud && stack.hudTransform === "none";
    record("STACK_gl_hud", glOk && hudOk, JSON.stringify(stack));
    await shot("04-play-stack.png");
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
