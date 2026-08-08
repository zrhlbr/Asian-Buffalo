import { chromium, devices } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:5173";
const throttle = process.argv.includes("--throttle");
const browser = await chromium.launch({ headless: true });
const mobile = devices["iPhone 12"];
const ctx = await browser.newContext({
  ...mobile,
  viewport: { width: 390, height: 844 },
});
const page = await ctx.newPage();
if (throttle) {
  const client = await ctx.newCDPSession(page);
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150,
  });
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  console.log("throttle ON");
}
await page.goto(`${base}/xi`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForSelector('[data-testid="xi-lobby-root"]', { timeout: 60000 });
const cards = await page.$$eval('[data-testid="xi-card-bdk"]', (els) =>
  els.map((e) => ({
    tag: e.tagName,
    cls: e.className,
    href: e.getAttribute("data-href") || e.getAttribute("href"),
    rect: e.getBoundingClientRect().toJSON(),
    pe: getComputedStyle(e).pointerEvents,
    z: getComputedStyle(e).zIndex,
  })),
);
console.log("cards", JSON.stringify(cards, null, 2));
const top = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="xi-card-bdk"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const hit = document.elementFromPoint(x, y);
  return {
    x,
    y,
    hit: hit && {
      testid: hit.getAttribute("data-testid"),
      cls: hit.className,
      tag: hit.tagName,
    },
  };
});
console.log("elementFromPoint", top);
await page.locator('[data-testid="xi-card-bdk"]').first().click({ force: true, timeout: 10000 });
await page.waitForTimeout(2500);
console.log("url", page.url());
console.log(
  "hub",
  !!(await page.$('[data-testid="xi-bdk-hub"]')),
  "pending",
  await page.evaluate(() => document.documentElement.className),
);
await browser.close();
