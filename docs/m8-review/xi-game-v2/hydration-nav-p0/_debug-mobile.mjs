import { chromium, devices } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://127.0.0.1:5173";
const browser = await chromium.launch({ headless: true });
const mobile = devices["iPhone 12"];
const ctx = await browser.newContext({
  ...mobile,
  viewport: { width: 390, height: 844 },
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("ERR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CERR", m.text());
});
try {
  const client = await ctx.newCDPSession(page);
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  });
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
} catch (e) {
  console.log("throttle skip", e.message);
}
await page.goto(`${base}/xi`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 60000 });
const ready = await page
  .waitForFunction(
    () => window.__xiNavReady === true && window.__xiUiHydrated === true,
    { timeout: 120000 },
  )
  .then(() => true)
  .catch(() => false);
console.log("lobby ok", page.url(), "clientReady", ready, await page.evaluate(() => ({
  nav: window.__xiNavReady,
  ui: window.__xiUiHydrated,
})));
await page.click('[data-testid="xi-card-bdk"]');
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1000);
  const info = await page.evaluate(() => ({
    path: location.pathname,
    hub: !!document.querySelector('[data-testid="xi-bdk-hub"]'),
    start: !!document.querySelector('[data-testid="xi-start-game"]'),
    shell: document.querySelector('[data-testid="xi-shell"]')?.getAttribute("data-xi-path"),
    pending: document.documentElement.classList.contains("xi-nav-pending"),
    busy: document.documentElement.classList.contains("xi-nav-busy"),
  }));
  console.log(`t+${i + 1}s`, info);
  if (info.start) break;
}
const start = await page.$('[data-testid="xi-start-game"]');
if (start) {
  console.log("visible", await start.isVisible(), "box", await start.boundingBox());
}
await page.screenshot({
  path: join(__dirname, "screenshots", "mobile-debug.png"),
  fullPage: true,
});
await browser.close();
