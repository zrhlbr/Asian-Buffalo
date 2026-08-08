import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const failed = [];
page.on("requestfailed", r => failed.push({ url: r.url(), err: r.failure()?.errorText }));
page.on("response", async r => {
  if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() });
});
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);
console.log("FAILED", JSON.stringify(failed.slice(0,40), null, 2));
// Check if preserveDrawingBuffer explains black drawImage
const info = await page.evaluate(() => {
  const r = window.__game.world.renderer;
  return {
    preserveDrawingBuffer: r.getContextAttributes?.()?.preserveDrawingBuffer,
    alpha: r.getContextAttributes?.()?.alpha,
    antialias: r.getContextAttributes?.()?.antialias,
  };
});
console.log("GL_ATTRS", info);
await browser.close();
