import { chromium } from "playwright";
import fs from "fs";

const outDir = "docs/m8-review/blocker-blackscreen-p0";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") logs.push(m.type() + ": " + m.text());
});
page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message));

await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(4500);

const probe = await page.evaluate(() => {
  const gl = document.getElementById("gl");
  const hud = document.getElementById("hud");
  const loading = document.getElementById("loading");
  const app = document.getElementById("app");
  const g = window.__game;
  const st = g?.state?.() ?? null;
  const canvas = gl;
  let pixels = null;
  let webgl = null;
  try {
    const ctx = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (ctx) {
      webgl = {
        lost: ctx.isContextLost?.() ?? null,
        drawingBufferWidth: ctx.drawingBufferWidth,
        drawingBufferHeight: ctx.drawingBufferHeight,
      };
      const w = Math.min(64, canvas.width);
      const h = Math.min(64, canvas.height);
      const data = new Uint8Array(w * h * 4);
      ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, data);
      let sum = 0, nonZero = 0, max = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
        if (data[i] > 0) nonZero++;
        if (data[i] > max) max = data[i];
      }
      pixels = { w, h, avg: sum / data.length, nonZero, max, sample: Array.from(data.slice(0, 16)) };
    }
  } catch (e) {
    pixels = { err: String(e) };
  }
  // Sample center CSS pixels via 2d? can't. Use cover check.
  const mid = document.elementFromPoint(640, 360);
  const midCS = mid ? getComputedStyle(mid) : null;
  return {
    app: app ? { w: app.clientWidth, h: app.clientHeight, class: app.className } : null,
    gl: gl ? {
      w: gl.clientWidth, h: gl.clientHeight, aw: gl.width, ah: gl.height,
      pe: getComputedStyle(gl).pointerEvents,
      z: getComputedStyle(gl).zIndex,
      display: getComputedStyle(gl).display,
      opacity: getComputedStyle(gl).opacity,
      vis: getComputedStyle(gl).visibility,
      rect: gl.getBoundingClientRect(),
    } : null,
    hud: hud ? {
      z: getComputedStyle(hud).zIndex,
      pe: getComputedStyle(hud).pointerEvents,
      bg: getComputedStyle(hud).background,
      opacity: getComputedStyle(hud).opacity,
    } : null,
    loading: loading ? {
      done: loading.classList.contains("done"),
      pe: getComputedStyle(loading).pointerEvents,
      vis: getComputedStyle(loading).visibility,
      opacity: getComputedStyle(loading).opacity,
      z: getComputedStyle(loading).zIndex,
      display: getComputedStyle(loading).display,
    } : null,
    midHit: mid ? { id: mid.id, tag: mid.tagName, class: mid.className, pe: midCS?.pointerEvents, bg: midCS?.backgroundColor } : null,
    state: st,
    hasGame: !!g,
    webgl,
    pixels,
  };
});

fs.writeFileSync(outDir + "/before-probe.json", JSON.stringify({ probe, logs: logs.slice(0, 40) }, null, 2));
await page.screenshot({ path: outDir + "/before-idle.png", fullPage: false });
console.log(JSON.stringify({ probe, logs: logs.slice(0, 40) }, null, 2));
await browser.close();
