import { chromium } from "playwright";
import fs from "fs";

// Reproduce stacking failure modes that could yield HUD-only + black body
const browser = await chromium.launch({ headless: true });
const results = {};

async function shot(name, initScript) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  if (initScript) await page.addInitScript(initScript);
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4500);
  const path = `docs/m8-review/blocker-blackscreen-p0/${name}.png`;
  await page.screenshot({ path });
  const info = await page.evaluate(() => {
    const g = window.__game?.state?.();
    return {
      hasGame: !!window.__game,
      loadingDone: document.getElementById("loading")?.classList.contains("done"),
      celebHidden: document.getElementById("celebration")?.classList.contains("hidden"),
      edge: g?.edge,
      sceneN: window.__game?.world?.scene?.children?.length,
    };
  });
  // brightness from page screenshot via CDP
  const buf = await page.screenshot();
  // crude: count non-dark bytes in PNG IDAT is hard; use evaluate after drawing screenshot? 
  results[name] = info;
  console.log(name, JSON.stringify(info));
  await page.close();
}

await shot("repro-baseline", null);

// Force WebGL lose context after boot
await shot("repro-context-lost", () => {
  window.addEventListener("load", () => {
    setTimeout(() => {
      try {
        const ext = window.__game?.world?.renderer?.getContext()?.getExtension("WEBGL_lose_context");
        ext?.loseContext();
        console.warn("LOST CONTEXT");
      } catch {}
    }, 2500);
  });
});

// Hide canvas via style (simulates compositor miss)
await (async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => { document.getElementById("gl").style.visibility = "hidden"; });
  await page.screenshot({ path: "docs/m8-review/blocker-blackscreen-p0/repro-canvas-hidden.png" });
  console.log("repro-canvas-hidden", "forced visibility:hidden on #gl — expected HUD over black ink");
  await page.close();
})();

// Simulate stuck celebration
await (async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const c = document.getElementById("celebration");
    c.classList.remove("hidden");
    c.classList.add("tier-epic");
  });
  await page.screenshot({ path: "docs/m8-review/blocker-blackscreen-p0/repro-stuck-celebration.png" });
  console.log("repro-stuck-celebration done");
  await page.close();
})();

fs.writeFileSync("docs/m8-review/blocker-blackscreen-p0/repro-results.json", JSON.stringify(results, null, 2));
await browser.close();
