import { chromium, devices } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:5173";
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ ...devices["iPhone 13"] })).newPage();
page.on("pageerror", (e) => console.log("PE", e.message));

await page.goto(`${base}/xi/bull-demon-king`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid=xi-start-game]");
await page.waitForTimeout(1200);
await page.locator("[data-testid=xi-start-game]").click({ force: true });
await page.waitForFunction(() => window.__xiGameLifecycle === "ACTIVE", { timeout: 15000 });
console.log("on play", await page.evaluate(() => ({
  path: location.pathname,
  life: window.__xiGameLifecycle,
  back: !!document.querySelector("[data-testid='xi-play-back-hub']"),
  backs: document.querySelectorAll("[data-testid='xi-play-back-hub']").length,
  playKeep: document.querySelector("[data-testid='xi-play-keepalive']")?.className,
  hubKeep: document.querySelector("[data-testid='xi-hub-keepalive']")?.className,
})));

await page.locator("[data-testid=xi-play-back-hub]").first().click({ force: true });
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(100);
  console.log(i * 100, await page.evaluate(() => ({
    path: location.pathname,
    life: window.__xiGameLifecycle,
    opt: window.__xiOptimisticLayer,
    host: document.querySelector("#xi-game-host")?.className,
    hubKeep: document.querySelector("[data-testid='xi-hub-keepalive']")?.className,
    playKeep: document.querySelector("[data-testid='xi-play-keepalive']")?.className,
    hub: !!document.querySelector("[data-testid='xi-bdk-hub']"),
    hubOP: document.querySelector("[data-testid='xi-bdk-hub']")?.offsetParent !== null,
    pending: document.documentElement.classList.contains("xi-nav-pending"),
  })));
}
await browser.close();
