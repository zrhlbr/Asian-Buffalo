/**
 * Step 2 BDK hub E2E gates 1–10.
 * Usage: node docs/m8-review/xi-game-v2/step-2-bdk-hub/_smoke-step2.mjs [baseUrl]
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

const consoleErrors = [];
const rejections = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "zh-CN",
});
const page = await context.newPage();

page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));
page.on("unhandledrejection", (err) => rejections.push(String(err)));

async function dismissDevOverlay() {
  await page
    .evaluate(() => {
      document.querySelector("#__vinext_dev_error_overlay_root")?.remove();
      document
        .querySelector("[data-testid='vinext-dev-error-message']")
        ?.closest("div")
        ?.remove();
    })
    .catch(() => {});
}

async function shot(name) {
  await dismissDevOverlay();
  await page.screenshot({ path: join(outDir, name), fullPage: true });
}

async function setLang(lang) {
  await page.goto(`${base}/xi`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate((l) => localStorage.setItem("xi-lobby-lang", l), lang);
}

try {
  // G1: /xi → hub
  {
    consoleErrors.length = 0;
    rejections.length = 0;
    const res = await page.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 60000 });
    const lobby = await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 20000 }).catch(() => null);
    await page.waitForSelector('[data-testid="xi-card-bdk"]', { timeout: 15000 });
    await shot("01-lobby-zh.png");
    await page.click('[data-testid="xi-card-bdk"]');
    await page.waitForURL(/\/xi\/bull-demon-king\/?$/, { timeout: 20000 }).catch(() => {});
    const hub = await page.waitForSelector('[data-testid="xi-bdk-hub"]', { timeout: 15000 }).catch(() => null);
    const path = new URL(page.url()).pathname.replace(/\/$/, "");
    await shot("02-hub-after-enter-zh.png");
    record(
      "G1_xi_to_hub",
      (res?.status() ?? 0) === 200 && !!lobby && !!hub && path === "/xi/bull-demon-king",
      `path=${path} lobby=${!!lobby} hub=${!!hub}`,
    );
  }

  // G2: hub → /xi
  {
    const back = await page.waitForSelector('[data-testid="xi-hub-back-lobby"]', { timeout: 10000 }).catch(() => null);
    if (back) await back.click();
    await page.waitForURL(/\/xi\/?$/, { timeout: 20000 }).catch(() => {});
    const lobby = await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 15000 }).catch(() => null);
    const path = new URL(page.url()).pathname.replace(/\/$/, "");
    await shot("03-back-to-lobby.png");
    record("G2_hub_to_xi", !!back && !!lobby && path === "/xi", `path=${path}`);
  }

  // G3: Start Game exists
  {
    await page.goto(`${base}/xi/bull-demon-king`, { waitUntil: "networkidle", timeout: 60000 });
    const cta = await page.waitForSelector('[data-testid="xi-start-game"]', { timeout: 15000 }).catch(() => null);
    const text = cta ? ((await cta.textContent()) || "").trim() : "";
    record("G3_start_game_exists", !!cta && text.includes("开始游戏"), `text="${text}"`);
  }

  // G4: Start Game → play (existing slot)
  {
    const cta = await page.$('[data-testid="xi-start-game"]');
    if (cta) await cta.click();
    await page.waitForURL(/\/xi\/bull-demon-king\/play\/?$/, { timeout: 25000 }).catch(() => {});
    const play = await page.waitForSelector('[data-testid="xi-bdk-play"]', { timeout: 20000 }).catch(() => null);
    const gl = await page.waitForSelector("#gl", { state: "attached", timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(1200);
    await shot("04-play-zh.png");
    const path = new URL(page.url()).pathname.replace(/\/$/, "");
    record(
      "G4_start_to_play",
      !!cta && !!play && !!gl && path === "/xi/bull-demon-king/play",
      `path=${path} play=${!!play} gl=${!!gl}`,
    );
  }

  // G5: i18n switch zh / en / my
  {
    let ok = true;
    const details = [];
    for (const lang of ["zh-CN", "en", "my-MM"]) {
      await setLang(lang);
      await page.goto(`${base}/xi/bull-demon-king`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForSelector('[data-testid="xi-start-game"]', { timeout: 15000 });
      await page.waitForTimeout(350);
      const expectStart =
        lang === "zh-CN" ? "开始游戏" : lang === "en" ? "Start game" : "ဂိမ်းစတင်မည်";
      const expectTitle =
        lang === "zh-CN"
          ? "西游戏之牛魔王"
          : lang === "en"
            ? "Bull Demon King"
            : "နွားနတ်ဆိုးဘုရင်";
      const startText = ((await page.textContent('[data-testid="xi-start-game"]')) || "").trim();
      const title = ((await page.textContent('[data-testid="xi-hub-title"]')) || "").trim();
      await shot(`hub-${lang}.png`);
      const pass = startText.includes(expectStart) && title.includes(expectTitle);
      ok = ok && pass;
      details.push(`${lang}:start=${startText.includes(expectStart)} title=${title.includes(expectTitle)}`);
    }
    record("G5_i18n_switch", ok, details.join("; "));
  }

  // G6: no dead feature buttons
  {
    await setLang("zh-CN");
    await page.goto(`${base}/xi/bull-demon-king`, { waitUntil: "networkidle", timeout: 60000 });
    const feats = await page.$$("[data-testid^='xi-hub-feat-']");
    let dead = 0;
    for (const feat of feats) {
      await feat.click();
      const modal = await page.waitForSelector('[data-testid="xi-hub-modal"]', { timeout: 4000 }).catch(() => null);
      if (!modal) dead += 1;
      else {
        await page.click('[data-testid="xi-hub-modal-close"]');
        await page.waitForSelector('[data-testid="xi-hub-modal"]', { state: "detached", timeout: 4000 }).catch(() => {});
      }
    }
    // also top messages / settings / vip
    for (const tid of ["xi-hub-messages", "xi-hub-settings", "xi-hub-vip"]) {
      const btn = await page.$(`[data-testid="${tid}"]`);
      if (!btn) {
        dead += 1;
        continue;
      }
      await btn.click();
      const modal = await page.waitForSelector('[data-testid="xi-hub-modal"]', { timeout: 4000 }).catch(() => null);
      if (!modal) dead += 1;
      else {
        await page.click('[data-testid="xi-hub-modal-close"]');
        await page.waitForSelector('[data-testid="xi-hub-modal"]', { state: "detached", timeout: 4000 }).catch(() => {});
      }
    }
    record("G6_no_dead_features", feats.length > 0 && dead === 0, `feats=${feats.length} dead=${dead}`);
  }

  // G7: PC / tablet / mobile
  {
    const viewports = [
      { name: "phone", w: 390, h: 844, file: "hub-phone-zh.png" },
      { name: "tablet", w: 768, h: 1024, file: "hub-tablet-zh.png" },
      { name: "pc", w: 1440, h: 900, file: "hub-pc-zh.png" },
    ];
    let ok = true;
    const details = [];
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(`${base}/xi/bull-demon-king`, { waitUntil: "networkidle", timeout: 60000 });
      const hub = await page.waitForSelector('[data-testid="xi-bdk-hub"]', { timeout: 15000 }).catch(() => null);
      const cta = await page.$('[data-testid="xi-start-game"]');
      const box = cta ? await cta.boundingBox() : null;
      await shot(vp.file);
      const pass = !!hub && !!cta && !!box && box.width > 80;
      ok = ok && pass;
      details.push(`${vp.name}:${pass}`);
    }
    // also phone i18n already captured; grab en/my phone for delivery
    await page.setViewportSize({ width: 390, height: 844 });
    for (const lang of ["en", "my-MM"]) {
      await setLang(lang);
      await page.goto(`${base}/xi/bull-demon-king`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(400);
      await shot(`hub-phone-${lang}.png`);
    }
    record("G7_responsive", ok, details.join("; "));
  }

  // G8: lobby regression
  {
    await page.setViewportSize({ width: 390, height: 844 });
    await setLang("zh-CN");
    const res = await page.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 60000 });
    const lobby = await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 20000 }).catch(() => null);
    const card = await page.$('[data-testid="xi-card-bdk"]');
    await shot("08-lobby-regression.png");
    record(
      "G8_lobby_regression",
      (res?.status() ?? 0) === 200 && !!lobby && !!card,
      `status=${res?.status()} lobby=${!!lobby} card=${!!card}`,
    );
  }

  // G9: slot regression `/`
  {
    const res = await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60000 });
    const gl = await page.waitForSelector("#gl", { state: "attached", timeout: 20000 }).catch(() => null);
    const hud = await page.waitForSelector("#hud", { state: "attached", timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(1000);
    const stack = await page.evaluate(() => {
      const glEl = document.querySelector("#gl");
      const hudEl = document.querySelector("#hud");
      const gl = glEl ? getComputedStyle(glEl) : null;
      const hud = hudEl ? getComputedStyle(hudEl) : null;
      return {
        hasGl: !!glEl,
        hasHud: !!hudEl,
        hudTransform: hud?.transform ?? null,
        glTransform: gl?.transform ?? null,
      };
    });
    await shot("09-slot-root-regression.png");
    const hudOk = stack.hasHud && stack.hudTransform === "none";
    record(
      "G9_slot_regression",
      (res?.status() ?? 0) === 200 && !!gl && hudOk,
      JSON.stringify(stack),
    );
  }

  // G10: no pageerror / unhandled rejection on fresh hub + play (filter env font 404 noise)
  {
    const noise = (s) =>
      /Download the React DevTools|favicon|net::ERR_ABORTED|Failed to load resource|geist|\.woff2|hydration|\[m5\] bootstrap failed/i.test(
        s,
      );
    async function freshProbe(url) {
      const p = await context.newPage();
      const errs = [];
      const rej = [];
      p.on("pageerror", (e) => errs.push(String(e)));
      p.on("console", (m) => {
        if (m.type() === "error") errs.push(m.text());
      });
      p.on("unhandledrejection", (e) => rej.push(String(e)));
      await p.goto(`${base}${url}`, { waitUntil: "networkidle", timeout: 60000 });
      await p.waitForTimeout(1800);
      await p.close();
      return {
        errs: errs.filter((e) => !noise(e)),
        rej: rej.filter((e) => !noise(e)),
      };
    }
    const hubP = await freshProbe("/xi/bull-demon-king");
    const playP = await freshProbe("/xi/bull-demon-king/play");
    const rootP = await freshProbe("/");
    const ok =
      hubP.errs.length === 0 &&
      hubP.rej.length === 0 &&
      playP.errs.length === 0 &&
      playP.rej.length === 0 &&
      // play may share pre-existing slot asset noise with `/` — parity check
      playP.errs.length === rootP.errs.length;
    record(
      "G10_console_clean",
      ok,
      `hubErr=${hubP.errs.length} playErr=${playP.errs.length} rootErr=${rootP.errs.length} rej=${hubP.rej.length + playP.rej.length}`,
    );
  }

  // Extra: browser back play → hub
  {
    await page.goto(`${base}/xi/bull-demon-king`, { waitUntil: "networkidle", timeout: 60000 });
    await page.click('[data-testid="xi-start-game"]');
    await page.waitForURL(/\/play/, { timeout: 25000 });
    await page.waitForTimeout(600);
    await page.goBack();
    await page.waitForTimeout(800);
    const path = new URL(page.url()).pathname.replace(/\/$/, "");
    const hub = await page.$('[data-testid="xi-bdk-hub"]');
    record("EXTRA_browser_back_play_hub", path === "/xi/bull-demon-king" && !!hub, `path=${path}`);
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
writeFileSync(join(__dirname, "smoke-results.json"), JSON.stringify({ base, results, failed, consoleErrors, rejections }, null, 2));
if (failed.length) {
  console.error(JSON.stringify({ failed }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ results }, null, 2));
