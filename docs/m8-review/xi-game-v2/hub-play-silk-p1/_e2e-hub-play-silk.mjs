/**
 * Hub↔Play silk P1 E2E — ×20 loops + singleton + black + hydration probes.
 * Measures UI-first (host ACTIVE / SUSPENDED), not RSC pathname settle.
 * Usage: node docs/m8-review/xi-game-v2/hub-play-silk-p1/_e2e-hub-play-silk.mjs [baseUrl]
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

const report = {
  base,
  startedAt: new Date().toISOString(),
  hydrationErrors: 0,
  unhandledErrors: 0,
  blackProbeFails: 0,
  duplicateGameClient: 0,
  duplicateCanvas: 0,
  hubToPlayMs: [],
  playToHubMs: [],
  clickFeedbackMs: [],
  locales: {},
  mobileSimulated: null,
  details: [],
};

function stats(arr) {
  if (!arr.length) return { n: 0 };
  const s = [...arr].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n: s.length,
    avg: Math.round(sum / s.length),
    p50: s[Math.floor(s.length * 0.5)],
    p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
    max: s[s.length - 1],
    min: s[0],
  };
}

async function attachErrorGuards(page) {
  page.on("pageerror", (err) => {
    const text = String(err?.message || err);
    if (/hydrat/i.test(text)) report.hydrationErrors += 1;
    else report.unhandledErrors += 1;
    report.details.push({ type: "pageerror", text });
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/hydrat/i.test(text)) report.hydrationErrors += 1;
  });
}

async function sampleBlack(page) {
  const dark = await page.evaluate(() => {
    const host = document.querySelector("#xi-game-host");
    if (host?.classList.contains("is-active")) return false;
    const el =
      document.querySelector("[data-testid='xi-bdk-hub']") ||
      document.querySelector("[data-testid='xi-shell']") ||
      document.body;
    const text = (el.innerText || "").trim();
    return text.length < 8;
  });
  if (dark) {
    report.blackProbeFails += 1;
    report.details.push({ type: "black" });
  }
}

async function main() {
  console.log(`E2E Hub↔Play silk → ${base}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  await attachErrorGuards(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem("xi-perf-trace", "1");
    } catch {
      /* ignore */
    }
  });

  await page.goto(`${base}/xi/bull-demon-king`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='xi-start-game']", { timeout: 20000 });
  await page.waitForFunction(() => window.__xiNavReady === true).catch(() => {});
  await page.locator("[data-testid='xi-start-game']").hover().catch(() => {});
  await page.waitForTimeout(1600);

  for (let i = 0; i < LOOP_N; i++) {
    console.log(`loop ${i + 1}/${LOOP_N}`);
    await page.evaluate(() => {
      window.__xiPerfMarks = [];
    });

    const t0 = Date.now();
    await page.evaluate(() => {
      const t = performance.now();
      document.querySelector("[data-testid='xi-start-game']")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      const pending = document.documentElement.classList.contains("xi-nav-pending");
      window.__xiClickFb = pending ? performance.now() - t : performance.now() - t;
    });
    const fb = await page.evaluate(() => window.__xiClickFb ?? -1);
    if (fb >= 0) report.clickFeedbackMs.push(Math.round(fb));

    await page.waitForFunction(
      () =>
        document.querySelector("#xi-game-host")?.classList.contains("is-active") &&
        window.__xiGameLifecycle === "ACTIVE",
      { timeout: 15000 },
    );
    report.hubToPlayMs.push(Date.now() - t0);
    await sampleBlack(page);

    await page.waitForTimeout(60);
    const t1 = Date.now();
    await page.evaluate(() => {
      document.querySelector("[data-testid='xi-play-back-hub']")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
    await page.waitForFunction(
      () =>
        !document.querySelector("#xi-game-host")?.classList.contains("is-active") &&
        (window.__xiGameLifecycle === "SUSPENDED" ||
          window.__xiGameLifecycle === "READY"),
      { timeout: 15000 },
    );
    report.playToHubMs.push(Date.now() - t1);
    await sampleBlack(page);

    const snap = await page.evaluate(() => ({
      gc: window.__xiGameClientCount ?? 0,
      canvas: document.querySelectorAll("canvas#gl").length,
    }));
    if (snap.gc > 1) report.duplicateGameClient += 1;
    if (snap.canvas > 1) report.duplicateCanvas += 1;
  }

  for (const lang of ["zh-CN", "en", "my-MM"]) {
    await page.evaluate((l) => {
      localStorage.setItem("xi-lobby-lang", l);
      localStorage.setItem("ab-lang", l);
    }, lang);
    await page.goto(`${base}/xi/bull-demon-king`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-testid='xi-start-game']", {
      timeout: 20000,
      state: "attached",
    });
    await page.waitForTimeout(1000);
    await page.locator("[data-testid='xi-start-game']").click({ force: true });
    await page.waitForFunction(() => window.__xiGameLifecycle === "ACTIVE", {
      timeout: 15000,
    });
    await page.locator("[data-testid='xi-play-back-hub']").click({ force: true });
    await page.waitForFunction(
      () =>
        window.__xiGameLifecycle === "SUSPENDED" ||
        window.__xiGameLifecycle === "READY",
      { timeout: 15000 },
    );
    report.locales[lang] = { ok: true };
  }

  report.mobileSimulated = {
    device: "iPhone 13",
    hubToPlay: stats(report.hubToPlayMs),
    playToHub: stats(report.playToHubMs),
    clickFeedback: stats(report.clickFeedbackMs),
  };
  report.summary = {
    hubToPlay: stats(report.hubToPlayMs),
    playToHub: stats(report.playToHubMs),
    clickFeedback: stats(report.clickFeedbackMs),
    hydrationErrors: report.hydrationErrors,
    unhandledErrors: report.unhandledErrors,
    blackProbeFails: report.blackProbeFails,
    duplicateGameClient: report.duplicateGameClient,
    duplicateCanvas: report.duplicateCanvas,
    locales: report.locales,
  };
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(__dirname, "e2e-results.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  await page.screenshot({
    path: join(outDir, "hub-after-20-loops.png"),
    fullPage: true,
  });
  await browser.close();

  const fail =
    report.hydrationErrors > 0 ||
    report.unhandledErrors > 0 ||
    report.blackProbeFails > 0 ||
    report.duplicateGameClient > 0 ||
    report.duplicateCanvas > 0;
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(
    join(__dirname, "e2e-results.json"),
    JSON.stringify({ error: String(err), report }, null, 2),
  );
  process.exit(2);
});
