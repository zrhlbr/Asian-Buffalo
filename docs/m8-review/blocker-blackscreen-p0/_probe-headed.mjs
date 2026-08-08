import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// Sample PAGE screenshot pixels (not WebGL buffer) — ground truth for "black main"
function samplePngCenter(file) {
  // use sharp if available else pure decode via playwright screenshot buffer analysis in-page
  return null;
}

const browser = await chromium.launch({ headless: false, args: ["--disable-gpu-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(5000);
const shotPath = "docs/m8-review/blocker-blackscreen-p0/headed-idle.png";
await page.screenshot({ path: shotPath });

// Analyze screenshot PNG via createImageBitmap in page? better: read with pure node pngjs or canvas
// Use page.evaluate on a drawn copy of the screenshot by fetching it as file — instead sample via CDP
const metrics = await page.evaluate(async () => {
  // Capture the visual layer via html2canvas-like: use element screenshot isn't available.
  // Sample by drawing the whole document isn't possible.
  // Instead inspect compositor: check if canvas has non-zero painted area via Intersection and getClientRects
  const gl = document.getElementById("gl");
  const cs = getComputedStyle(gl);
  const attrs = window.__game.world.renderer.getContext().getContextAttributes();
  // Force render then read with preserve — temporarily
  const r = window.__game.world.renderer;
  const prev = r.getContextAttributes();
  // Read after render into Uint8Array from THREE render target
  const THREE = await import("/node_modules/.vite/deps/three.js?v=f0f88d7e").catch(()=>null);
  return {
    attrs,
    glCss: { opacity: cs.opacity, visibility: cs.visibility, z: cs.zIndex, pe: cs.pointerEvents, mix: cs.mixBlendMode, filter: cs.filter, transform: cs.transform },
    hudCss: (()=>{ const h=document.getElementById("hud"); const c=getComputedStyle(h); return { z:c.zIndex, transform:c.transform, bg:c.backgroundColor, isolation:c.isolation }; })(),
    appBg: getComputedStyle(document.getElementById("app")).backgroundColor,
  };
});

// Pixel-sample the saved screenshot using pure PNG parse (zlib) — use playwright's built-in: re-load image in page
const abs = path.resolve(shotPath).replace(/\\/g, "/");
const pixelSample = await page.evaluate(async (p) => {
  // can't read filesystem; use canvas capture of viewport via Offscreen? 
  return null;
}, abs);

// Use CDP Page.captureScreenshot and decode — simpler approach with pngjs if installed
let pngAnalysis = null;
try {
  const { PNG } = await import("pngjs");
  const buf = fs.readFileSync(shotPath);
  const png = PNG.sync.read(buf);
  const { width, height, data } = png;
  // sample center band excluding top 12% and bottom 18% (HUD)
  const y0 = Math.floor(height * 0.18);
  const y1 = Math.floor(height * 0.78);
  const x0 = Math.floor(width * 0.1);
  const x1 = Math.floor(width * 0.9);
  let sum=0,nz=0,max=0,n=0;
  let blackish=0;
  for (let y=y0;y<y1;y+=2) for (let x=x0;x<x1;x+=2) {
    const i=(y*width+x)*4;
    const v=(data[i]+data[i+1]+data[i+2])/3;
    sum+=v; n++; if(v>12) nz++; if(v>max) max=v; if(v<8) blackish++;
  }
  pngAnalysis = { width, height, avg: sum/n, nz, max, blackishRatio: blackish/n, n };
} catch (e) {
  pngAnalysis = { err: String(e) };
}

fs.writeFileSync("docs/m8-review/blocker-blackscreen-p0/headed-probe.json", JSON.stringify({ metrics, pngAnalysis }, null, 2));
console.log(JSON.stringify({ metrics, pngAnalysis }, null, 2));
await browser.close();
