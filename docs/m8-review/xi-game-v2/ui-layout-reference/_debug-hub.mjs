import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:5174/xi/bull-demon-king", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const img = document.querySelector("[data-testid='xi-hub-hero-img']");
  const box = document.querySelector(".xi-bdk-hero-photo");
  const hub = document.querySelector("[data-testid='xi-bdk-hub']");
  const cs = img ? getComputedStyle(img) : null;
  const bs = box ? getComputedStyle(box) : null;
  return {
    hubClass: hub?.className,
    img: img
      ? {
          src: img.getAttribute("src"),
          rect: img.getBoundingClientRect(),
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          w: cs.width,
          h: cs.height,
          natural: [img.naturalWidth, img.naturalHeight],
        }
      : null,
    box: box
      ? {
          rect: box.getBoundingClientRect(),
          display: bs.display,
          aspect: bs.aspectRatio,
          h: bs.height,
          w: bs.width,
        }
      : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({
  path: "docs/m8-review/xi-game-v2/ui-layout-reference/screenshots/02-hub-debug.png",
  fullPage: true,
});
await browser.close();
