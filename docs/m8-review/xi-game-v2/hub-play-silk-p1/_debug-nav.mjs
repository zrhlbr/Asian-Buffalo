import { chromium, devices } from "playwright";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://127.0.0.1:5173";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();
await page.addInitScript(() => {
  try {
    localStorage.setItem("xi-perf-trace", "1");
  } catch {
    /* ignore */
  }
});

await page.goto(`${base}/xi/bull-demon-king`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid=xi-start-game]");
await page.waitForFunction(() => window.__xiNavReady === true).catch(() => {});
await page.locator("[data-testid=xi-start-game]").hover().catch(() => {});
await page.waitForTimeout(1600);

const hubToPlay = [];
const playToHub = [];
const clickFb = [];

for (let i = 0; i < 8; i++) {
  await page.evaluate(() => {
    window.__xiPerfMarks = [];
  });

  const t0 = Date.now();
  await page.evaluate(() => {
    const btn = document.querySelector("[data-testid='xi-start-game']");
    btn?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(
    () =>
      document.querySelector("#xi-game-host")?.classList.contains("is-active") &&
      window.__xiGameLifecycle === "ACTIVE",
    { timeout: 15000 },
  );
  hubToPlay.push(Date.now() - t0);
  const marks1 = await page.evaluate(() => window.__xiPerfMarks || []);
  const click = marks1.find((m) => m.name === "clickFeedbackAt");
  const route = marks1.find((m) => m.name === "routeClickAt");
  if (click && route) clickFb.push(Math.round(click.t - route.t));

  await page.waitForTimeout(80);
  await page.evaluate(() => {
    window.__xiPerfMarks = [];
  });

  const t1 = Date.now();
  await page.evaluate(() => {
    const btn = document.querySelector("[data-testid='xi-play-back-hub']");
    btn?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForFunction(
    () =>
      !document.querySelector("#xi-game-host")?.classList.contains("is-active") &&
      (window.__xiGameLifecycle === "SUSPENDED" ||
        window.__xiGameLifecycle === "READY") &&
      document.querySelector("[data-testid='xi-hub-keepalive']")?.classList.contains(
        "is-active",
      ),
    { timeout: 15000 },
  );
  playToHub.push(Date.now() - t1);

  const snap = await page.evaluate(() => ({
    gc: window.__xiGameClientCount,
    canvas: document.querySelectorAll("canvas#gl").length,
    life: window.__xiGameLifecycle,
    path: location.pathname,
  }));
  console.log(`loop ${i + 1}`, {
    hubToPlay: hubToPlay[i],
    playToHub: playToHub[i],
    ...snap,
  });
  if (snap.gc > 1 || snap.canvas > 1) throw new Error("singleton broken");
}

function stats(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n: s.length,
    avg: Math.round(sum / s.length),
    p50: s[Math.floor(s.length * 0.5)],
    p95: s[Math.floor(s.length * 0.95)],
    max: s[s.length - 1],
    min: s[0],
    all: s,
  };
}

const report = {
  hubToPlay: stats(hubToPlay),
  playToHub: stats(playToHub),
  clickFeedback: stats(clickFb),
  device: "iPhone 13 simulated",
};
console.log(JSON.stringify(report, null, 2));
writeFileSync(join(__dirname, "debug-nav-results.json"), JSON.stringify(report, null, 2));
await browser.close();
