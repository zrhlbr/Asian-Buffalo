/**
 * Hydration-nav P0 E2E — Lobby↔Hub↔Play loop ×20 + black probe + i18n.
 * Usage: node docs/m8-review/xi-game-v2/hydration-nav-p0/_e2e-hydration-nav.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://127.0.0.1:5173";
const outDir = join(__dirname, "screenshots");
mkdirSync(outDir, { recursive: true });

const LOOP_N = 20;
const BLACK_LUMA = 18;
const BLACK_FAIL_MS = 150;
const SAMPLE_MS = 60;

const report = {
  base,
  startedAt: new Date().toISOString(),
  hydrationErrors: 0,
  unhandledErrors: 0,
  blackProbeFails: 0,
  duplicateGameClient: 0,
  loopsOk: 0,
  navTimesMs: [],
  clickFeedbackMs: [],
  locales: {},
  mobileSimulated: null,
  details: [],
};

function log(msg) {
  console.log(msg);
}

async function attachErrorGuards(page) {
  page.on("pageerror", (err) => {
    const text = String(err?.message || err);
    if (/hydrat/i.test(text)) report.hydrationErrors += 1;
    else report.unhandledErrors += 1;
    report.details.push({ type: "pageerror", text });
    log(`PAGEERROR: ${text}`);
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/hydrat/i.test(text)) {
      report.hydrationErrors += 1;
      report.details.push({ type: "console-hydration", text });
      log(`HYDRATION CONSOLE: ${text}`);
    }
  });
}

async function sampleBlackStreak(page, durationMs = 900) {
  const start = Date.now();
  let streak = 0;
  let maxStreak = 0;
  while (Date.now() - start < durationMs) {
    const dark = await page.evaluate((lumaLimit) => {
      const el =
        document.querySelector("[data-testid='xi-lobby-root']") ||
        document.querySelector("[data-testid='xi-bdk-hub']") ||
        document.querySelector("[data-testid='xi-bdk-play']") ||
        document.querySelector("[data-testid='xi-shell']") ||
        document.body;
      const r = el.getBoundingClientRect();
      const x = Math.max(8, Math.floor(r.left + r.width * 0.5));
      const y = Math.max(8, Math.floor(r.top + r.height * 0.45));
      // Approximate via canvas sample of viewport pixels when available
      const canvas = document.querySelector("#gl");
      if (canvas && canvas.width > 0) {
        try {
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            const p = ctx.getImageData(
              Math.min(canvas.width - 1, (x / window.innerWidth) * canvas.width),
              Math.min(canvas.height - 1, (y / window.innerHeight) * canvas.height),
              1,
              1,
            ).data;
            const luma = 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
            return luma < lumaLimit;
          }
        } catch {
          /* WebGL canvas — fall through */
        }
      }
      const cs = getComputedStyle(el);
      const bg = cs.backgroundColor || "";
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) {
        // Presence of substantive chrome text ⇒ not black void
        const text = (el.innerText || "").trim();
        return text.length < 8;
      }
      const luma =
        0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3]);
      const text = (el.innerText || "").trim();
      return luma < lumaLimit && text.length < 12;
    }, BLACK_LUMA);
    if (dark) {
      streak += SAMPLE_MS;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
    await page.waitForTimeout(SAMPLE_MS);
  }
  return maxStreak;
}

async function clickAndMeasure(page, selector) {
  const el = await page.waitForSelector(selector, { timeout: 15000 });
  await el.scrollIntoViewIfNeeded().catch(() => {});
  // Measure handler→pending in-page (excludes Playwright actionability wait)
  const feedback = await el.evaluate((node) => {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const done = () => resolve(Math.round(performance.now() - t0));
      const obs = new MutationObserver(() => {
        if (
          document.documentElement.classList.contains("xi-nav-pending") ||
          document.querySelector("[data-testid='xi-nav-transition']")
        ) {
          obs.disconnect();
          done();
        }
      });
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        subtree: true,
      });
      node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      setTimeout(() => {
        obs.disconnect();
        done();
      }, 120);
    });
  });
  report.clickFeedbackMs.push(feedback);
  return feedback;
}

async function waitLayer(page, testId, pathRe, timeout = 20000) {
  await page.waitForURL(pathRe, { timeout }).catch(() => {});
  return page.waitForSelector(`[data-testid="${testId}"]`, { timeout }).catch(() => null);
}

/** Wait until XiShell has hydrated + soft navigator registered (avoids dead pre-hydrate clicks). */
async function waitXiClientReady(page, timeout = 90000) {
  await page.waitForSelector('[data-testid="xi-shell"]', { timeout }).catch(() => null);
  await page
    .waitForFunction(
      () => window.__xiNavReady === true && window.__xiUiHydrated === true,
      { timeout },
    )
    .catch(() => {});
}

async function runLoop(page, n) {
  for (let i = 0; i < n; i++) {
    const tLoop = Date.now();
    // Lobby → Hub
    if (!/\/xi\/?$/.test(new URL(page.url()).pathname)) {
      await page.goto(`${base}/xi`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 20000 });
    }
    const t0 = Date.now();
    await clickAndMeasure(page, '[data-testid="xi-card-bdk"]');
    await waitLayer(page, "xi-bdk-hub", /\/xi\/bull-demon-king\/?$/);
    report.navTimesMs.push({ step: "lobby→hub", ms: Date.now() - t0, loop: i });

    let black = await sampleBlackStreak(page, 500);
    if (black > BLACK_FAIL_MS) {
      report.blackProbeFails += 1;
      report.details.push({ type: "black", step: "lobby→hub", black, loop: i });
    }

    // Hub → Play
    const t1 = Date.now();
    await clickAndMeasure(page, '[data-testid="xi-start-game"]');
    await waitLayer(page, "xi-bdk-play", /\/xi\/bull-demon-king\/play\/?$/, 30000);
    await page.waitForSelector("#gl", { timeout: 20000 }).catch(() => null);
    report.navTimesMs.push({ step: "hub→play", ms: Date.now() - t1, loop: i });

    black = await sampleBlackStreak(page, 700);
    if (black > BLACK_FAIL_MS) {
      report.blackProbeFails += 1;
      report.details.push({ type: "black", step: "hub→play", black, loop: i });
    }

    const count = await page.evaluate(() => window.__xiGameClientCount ?? 0);
    if (count > 1) {
      report.duplicateGameClient += 1;
      report.details.push({ type: "dup-game", count, loop: i });
    }

    // Play → Hub
    const t2 = Date.now();
    await clickAndMeasure(page, '[data-testid="xi-play-back-hub"]');
    await waitLayer(page, "xi-bdk-hub", /\/xi\/bull-demon-king\/?$/);
    report.navTimesMs.push({ step: "play→hub", ms: Date.now() - t2, loop: i });

    black = await sampleBlackStreak(page, 500);
    if (black > BLACK_FAIL_MS) {
      report.blackProbeFails += 1;
      report.details.push({ type: "black", step: "play→hub", black, loop: i });
    }

    // Hub → Lobby
    const t3 = Date.now();
    await clickAndMeasure(page, '[data-testid="xi-hub-back-lobby"]');
    await waitLayer(page, "xi-lobby-root", /\/xi\/?$/);
    report.navTimesMs.push({ step: "hub→lobby", ms: Date.now() - t3, loop: i });

    black = await sampleBlackStreak(page, 500);
    if (black > BLACK_FAIL_MS) {
      report.blackProbeFails += 1;
      report.details.push({ type: "black", step: "hub→lobby", black, loop: i });
    }

    report.loopsOk += 1;
    log(`LOOP ${i + 1}/${n} ok in ${Date.now() - tLoop}ms`);
  }
}

async function localePass(page, lang, testId) {
  await page.goto(`${base}/xi`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 20000 });
  await waitXiClientReady(page, 60000);
  const btn = await page.waitForSelector(`[data-testid="${testId}"]`, { timeout: 10000 });
  await btn.click();
  await page.waitForTimeout(300);
  await clickAndMeasure(page, '[data-testid="xi-card-bdk"]');
  await waitLayer(page, "xi-bdk-hub", /\/xi\/bull-demon-king\/?$/);
  await clickAndMeasure(page, '[data-testid="xi-start-game"]');
  await waitLayer(page, "xi-bdk-play", /\/xi\/bull-demon-king\/play\/?$/, 30000);
  await clickAndMeasure(page, '[data-testid="xi-play-back-hub"]');
  await waitLayer(page, "xi-bdk-hub", /\/xi\/bull-demon-king\/?$/);
  await clickAndMeasure(page, '[data-testid="xi-hub-back-lobby"]');
  await waitLayer(page, "xi-lobby-root", /\/xi\/?$/);
  const shellLang = await page.locator('[data-testid="xi-lobby-root"]').getAttribute("data-lang");
  report.locales[lang] = {
    ok: shellLang === lang && report.hydrationErrors === 0,
    dataLang: shellLang,
  };
  await page.screenshot({ path: join(outDir, `i18n-${lang}.png`), fullPage: true });
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "zh-CN",
  });
  const page = await context.newPage();
  await attachErrorGuards(page);

  await page.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 30000 });
  await waitXiClientReady(page, 60000);
  await page.screenshot({ path: join(outDir, "01-lobby.png"), fullPage: true });

  await runLoop(page, LOOP_N);

  const hydraBeforeLocale = report.hydrationErrors;
  await localePass(page, "zh-CN", "xi-lang-zh-CN");
  await localePass(page, "en", "xi-lang-en");
  await localePass(page, "my-MM", "xi-lang-my-MM");
  // locale passes may add nav; hydration delta tracked in totals

  // Mobile SIMULATED
  const mobile = devices["iPhone 12"];
  const mctx = await browser.newContext({
    ...mobile,
    viewport: { width: 390, height: 844 },
  });
  const mpage = await mctx.newPage();
  await attachErrorGuards(mpage);
  // CPU/network throttling when CDP available
  try {
    const client = await mctx.newCDPSession(mpage);
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      latency: 150,
    });
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    report.mobileSimulated = {
      viewport: "390x844",
      network: "Slow-4G-approx",
      cpuThrottling: 4,
      note: "SIMULATED",
    };
  } catch (e) {
    report.mobileSimulated = {
      viewport: "390x844",
      note: "SIMULATED viewport only",
      throttleError: String(e?.message || e),
    };
  }
  try {
    await mpage.goto(`${base}/xi`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await mpage.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 60000 });
    await waitXiClientReady(mpage, 120000);
    const m0 = Date.now();
    await mpage.waitForLoadState("networkidle", { timeout: 120000 }).catch(() => {});
    const card = mpage.locator('[data-testid="xi-card-bdk"]').first();
    await card.waitFor({ state: "visible", timeout: 30000 });
    await card.scrollIntoViewIfNeeded();
    await card.click({ force: true, timeout: 30000 });
    const hubEl = await waitLayer(mpage, "xi-bdk-hub", /\/xi\/bull-demon-king\/?$/, 90000);
    if (!hubEl) throw new Error("mobile: hub did not mount after card click");
    const start = await mpage.waitForSelector('[data-testid="xi-start-game"]', {
      timeout: 60000,
      state: "visible",
    });
    await start.scrollIntoViewIfNeeded();
    await start.click({ timeout: 30000 });
    await waitLayer(mpage, "xi-bdk-play", /\/xi\/bull-demon-king\/play\/?$/, 60000);
    const back = await mpage.waitForSelector('[data-testid="xi-play-back-hub"]', { timeout: 30000 });
    await back.click();
    await waitLayer(mpage, "xi-bdk-hub", /\/xi\/bull-demon-king\/?$/, 60000);
    const hubBack = await mpage.waitForSelector('[data-testid="xi-hub-back-lobby"]', {
      timeout: 30000,
    });
    await hubBack.click();
    await waitLayer(mpage, "xi-lobby-root", /\/xi\/?$/, 60000);
    report.mobileSimulated.fullCycleMs = Date.now() - m0;
    report.mobileSimulated.ok = true;
    await mpage.screenshot({ path: join(outDir, "mobile-lobby.png"), fullPage: true });
  } catch (e) {
    report.mobileSimulated = {
      ...(report.mobileSimulated || {}),
      ok: false,
      error: String(e?.message || e),
      note: "SIMULATED",
    };
    await mpage.screenshot({ path: join(outDir, "mobile-fail.png"), fullPage: true }).catch(() => {});
    report.details.push({ type: "mobile-fail", error: String(e?.message || e) });
  } finally {
    await mctx.close();
  }

  report.finishedAt = new Date().toISOString();
  report.pass =
    report.hydrationErrors === 0 &&
    report.unhandledErrors === 0 &&
    report.blackProbeFails === 0 &&
    report.duplicateGameClient === 0 &&
    report.loopsOk >= LOOP_N &&
    report.mobileSimulated?.ok !== false;

  const avg = (arr) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  report.summary = {
    loopsOk: report.loopsOk,
    hydrationErrors: report.hydrationErrors,
    unhandledErrors: report.unhandledErrors,
    blackProbeFails: report.blackProbeFails,
    duplicateGameClient: report.duplicateGameClient,
    avgClickFeedbackMs: avg(report.clickFeedbackMs),
    avgNavByStep: ["lobby→hub", "hub→play", "play→hub", "hub→lobby"].map((step) => {
      const ms = report.navTimesMs.filter((x) => x.step === step).map((x) => x.ms);
      return { step, avgMs: avg(ms), n: ms.length };
    }),
    locales: report.locales,
    mobileSimulated: report.mobileSimulated,
    pass: report.pass,
    hydraBeforeLocale,
  };

  writeFileSync(join(__dirname, "e2e-results.json"), JSON.stringify(report, null, 2));
  log(JSON.stringify(report.summary, null, 2));
  if (!report.pass) process.exitCode = 1;
} catch (e) {
  report.finishedAt = new Date().toISOString();
  report.pass = false;
  report.summary = { error: String(e?.message || e), ...report };
  writeFileSync(join(__dirname, "e2e-results.json"), JSON.stringify(report, null, 2));
  log(`FATAL: ${e?.message || e}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
