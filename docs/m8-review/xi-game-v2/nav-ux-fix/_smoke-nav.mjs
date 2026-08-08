/**
 * Nav UX Fix E2E gates.
 * Usage: node docs/m8-review/xi-game-v2/nav-ux-fix/_smoke-nav.mjs [baseUrl]
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

async function dismissDevOverlay(page) {
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

async function shot(page, name) {
  await dismissDevOverlay(page);
  await page.screenshot({ path: join(outDir, name), fullPage: false });
}

async function waitPlayReady(page, timeout = 45000) {
  await page.waitForSelector('[data-testid="xi-bdk-play"]', { timeout });
  await page.waitForSelector("#gl", { timeout });
  await page.waitForSelector("#hud", { timeout });
  await page
    .waitForFunction(
      () => {
        const loading = document.getElementById("loading");
        return (
          !loading ||
          loading.classList.contains("done") ||
          loading.classList.contains("hidden")
        );
      },
      { timeout: 40000 },
    )
    .catch(() => {});
  await page.waitForTimeout(600);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  locale: "zh-CN",
  hasTouch: true,
});
const page = await context.newPage();

try {
  // G1 — Layer1 lobby: no back button
  {
    await page.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 20000 });
    const backCount = await page.locator("[data-testid='xi-hub-back-lobby']").count();
    const playBack = await page.locator("[data-testid='xi-play-back-hub']").count();
    await shot(page, "01-lobby-no-back.png");
    record(
      "G1_lobby_no_back",
      backCount === 0 && playBack === 0,
      `hubBack=${backCount} playBack=${playBack}`,
    );
  }

  // G2 — lobby → hub (card)
  {
    await page.click('[data-testid="xi-card-bdk"]');
    await page.waitForURL(/\/xi\/bull-demon-king\/?$/, { timeout: 20000 });
    await page.waitForSelector('[data-testid="xi-bdk-hub"]', { timeout: 15000 });
    await shot(page, "02-hub-zh.png");
    record("G2_lobby_to_hub", true, page.url());
  }

  // G3 — hub has visible back-to-lobby
  {
    const back = page.locator('[data-testid="xi-hub-back-lobby"]');
    const text = ((await back.textContent()) || "").trim();
    const visible = await back.isVisible();
    record(
      "G3_hub_back_lobby",
      visible && /返回大厅|Back to lobby|လော်ဘီ/.test(text),
      `visible=${visible} text=${text}`,
    );
  }

  // G4 — hub breadcrumb clickable → lobby
  {
    const crumb = page.locator('[data-testid="xi-hub-crumb-lobby"]');
    const crumbOk = (await crumb.count()) === 1;
    await crumb.click();
    await page.waitForURL(/\/xi\/?$/, { timeout: 20000 });
    await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 15000 });
    await shot(page, "03-hub-crumb-to-lobby.png");
    record("G4_hub_crumb_to_lobby", crumbOk, page.url());
  }

  // G5 — hub back button → lobby
  {
    await page.goto(`${base}/xi/bull-demon-king`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForSelector('[data-testid="xi-hub-back-lobby"]');
    await page.click('[data-testid="xi-hub-back-lobby"]');
    await page.waitForURL(/\/xi\/?$/, { timeout: 20000 });
    record("G5_hub_back_click", /\/xi\/?$/.test(new URL(page.url()).pathname), page.url());
  }

  // G6 — hub → play, #gl loads, translateZ preserved
  {
    await page.goto(`${base}/xi/bull-demon-king`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.click('[data-testid="xi-start-game"]');
    await page.waitForURL(/\/xi\/bull-demon-king\/play\/?$/, { timeout: 25000 });
    await waitPlayReady(page);
    const glOk = await page.evaluate(() => {
      const gl = document.getElementById("gl");
      const hud = document.getElementById("hud");
      if (!gl || !hud) return { ok: false, reason: "missing" };
      const glT = getComputedStyle(gl).transform;
      const hudT = getComputedStyle(hud).transform;
      const matrix3d = glT.includes("matrix3d") || glT === "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)";
      // translateZ(0) typically computes to matrix3d(...); never none for #gl
      const glHasLayer = glT !== "none";
      const hudNoShellZ = hudT === "none" || hudT === "matrix(1, 0, 0, 1, 0, 0)";
      return { ok: glHasLayer && hudNoShellZ, glT, hudT, matrix3d };
    });
    await shot(page, "04-play-gl.png");
    record("G6_play_gl_stack", !!glOk.ok, JSON.stringify(glOk));
  }

  // G7 — play back → hub
  {
    const back = page.locator('[data-testid="xi-play-back-hub"]');
    const text = ((await back.textContent()) || "").trim();
    record(
      "G7_play_back_label",
      /返回牛魔王首页|Back to Bull Demon King|နွားနတ်ဆိုး/.test(text),
      text,
    );
    await back.click();
    await page.waitForURL(/\/xi\/bull-demon-king\/?$/, { timeout: 20000 });
    await page.waitForSelector('[data-testid="xi-bdk-hub"]', { timeout: 15000 });
    await shot(page, "05-play-to-hub.png");
    record("G7_play_back_hub", true, page.url());
  }

  // G8 — play home → lobby + breadcrumb
  {
    await page.goto(`${base}/xi/bull-demon-king/play`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await waitPlayReady(page);
    const crumb = await page.locator('[data-testid="xi-play-breadcrumb"]').count();
    const home = page.locator('[data-testid="xi-play-home-lobby"]');
    const homeText = ((await home.textContent()) || "").trim();
    record(
      "G8_play_home_chrome",
      crumb === 1 && (await home.isVisible()) && /返回大厅|Back to lobby|🏠/.test(homeText),
      `crumb=${crumb} home=${homeText}`,
    );
    await home.click();
    await page.waitForURL(/\/xi\/?$/, { timeout: 20000 });
    await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 15000 });
    await shot(page, "06-play-home-lobby.png");
    record("G8_play_home_lobby", true, page.url());
  }

  // G9 — play breadcrumb hub crumb
  {
    await page.goto(`${base}/xi/bull-demon-king/play`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await waitPlayReady(page);
    await page.click('[data-testid="xi-play-crumb-hub"]');
    await page.waitForURL(/\/xi\/bull-demon-king\/?$/, { timeout: 20000 });
    record("G9_play_crumb_hub", true, page.url());
  }

  // G10 — i18n keys present in dict (page source / evaluated)
  {
    await page.goto(`${base}/xi/bull-demon-king`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.click('[data-testid="xi-hub-lang-en"]');
    await page.waitForTimeout(300);
    const enBack = ((await page.locator('[data-testid="xi-hub-back-lobby"]').textContent()) || "").trim();
    await page.click('[data-testid="xi-hub-lang-my-MM"]');
    await page.waitForTimeout(300);
    const myBack = ((await page.locator('[data-testid="xi-hub-back-lobby"]').textContent()) || "").trim();
    await page.click('[data-testid="xi-hub-lang-zh-CN"]');
    await page.waitForTimeout(200);
    const zhBack = ((await page.locator('[data-testid="xi-hub-back-lobby"]').textContent()) || "").trim();
    await shot(page, "07-hub-i18n.png");
    record(
      "G10_i18n_back_labels",
      /返回大厅/.test(zhBack) && /Back to lobby/.test(enBack) && myBack.length > 0,
      `zh=${zhBack} | en=${enBack} | my=${myBack}`,
    );
  }

  // G11 — ESC from hub → lobby (default on)
  {
    await page.goto(`${base}/xi/bull-demon-king`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForSelector('[data-testid="xi-bdk-hub"]');
    await page.keyboard.press("Escape");
    await page.waitForURL(/\/xi\/?$/, { timeout: 15000 });
    record("G11_esc_hub_to_lobby", true, page.url());
  }
} catch (err) {
  record("FATAL", false, String(err));
} finally {
  await browser.close();
}

const summary = {
  base,
  at: new Date().toISOString(),
  pass: results.filter((r) => r.ok).length,
  fail: results.filter((r) => !r.ok).length,
  results,
};
writeFileSync(join(__dirname, "smoke-results.json"), JSON.stringify(summary, null, 2));
console.log(`\nSummary: ${summary.pass} PASS / ${summary.fail} FAIL`);
process.exit(summary.fail ? 1 : 0);
