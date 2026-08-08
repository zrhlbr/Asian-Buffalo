import { chromium } from "playwright";
import fs from "fs";
const outDir = "docs/m8-review/blocker-blackscreen-p0";
const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader"] });

async function run(label, opts) {
  const page = await browser.newPage(opts);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type()==="error") errors.push(m.text()); });
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(5000);
  const path = `${outDir}/${label}.png`;
  await page.screenshot({ path });
  const bright = await page.evaluate(() => {
    const src = document.getElementById("gl");
    const c = document.createElement("canvas");
    c.width = 200; c.height = 112;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    try { ctx.drawImage(src, 0, 0, 200, 112); } catch (e) { return { err: String(e) }; }
    const img = ctx.getImageData(0, 0, 200, 112).data;
    let sum=0,nz=0,max=0;
    // sample center band only (avoid HUD)
    for (let y=30;y<90;y++) for (let x=20;x<180;x++) {
      const i=(y*200+x)*4; const v=(img[i]+img[i+1]+img[i+2])/3; sum+=v; if(v>8)nz++; if(v>max)max=v;
    }
    const n=(90-30)*(180-20);
    const g = window.__game?.state?.();
    const world = window.__game?.world;
    let meshStats = null;
    try {
      let tiles=0, visibleTiles=0, opSum=0;
      window.__game.rig.group.traverse(o=>{
        if(o.isMesh && o.material && o.material.map){
          tiles++; if(o.visible) visibleTiles++; opSum += o.material.opacity||0;
        }
      });
      meshStats={tiles, visibleTiles, avgOp: tiles?opSum/tiles:0, groupVis: window.__game.rig.group.visible};
    } catch(e){ meshStats={err:String(e)}; }
    return { avg: sum/n, nz, max, n, hasGame:!!window.__game, clarity:g?.clarity, edge:g?.edge, meshStats,
      disposed: world?.disposed, sceneN: world?.scene?.children?.length };
  });
  console.log(label, JSON.stringify({ bright, errors: errors.slice(0,15) }));
  fs.writeFileSync(`${outDir}/${label}.json`, JSON.stringify({ bright, errors }, null, 2));
  await page.close();
}

await run("v-desktop", { viewport: { width: 1280, height: 720 } });
await run("v-phone-land", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
await run("v-phone-port", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

// Remount stress: destroy and boot again if exposed
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);
const remount = await page.evaluate(async () => {
  const root = document.getElementById("app");
  const h = window.__game;
  // simulate destroy via exposed handle? only destroy on boot return — try disposing world then re-import
  try {
    // force dispose like React cleanup
    const w = window.__game.world;
    w.dispose();
    return { afterDispose: { disposed: w.disposed, lost: w.renderer.getContext().isContextLost() } };
  } catch (e) {
    return { err: String(e) };
  }
});
await page.waitForTimeout(500);
const after = await page.evaluate(() => {
  const src = document.getElementById("gl");
  const c = document.createElement("canvas");
  c.width = 160; c.height = 90;
  const ctx = c.getContext("2d");
  ctx.drawImage(src, 0, 0, 160, 90);
  const img = ctx.getImageData(0,0,160,90).data;
  let sum=0,nz=0;
  for(let i=0;i<img.length;i+=4){const v=(img[i]+img[i+1]+img[i+2])/3;sum+=v;if(v>8)nz++;}
  return { avg: sum/(img.length/4), nz, remountNote: "after forced dispose without remount" };
});
await page.screenshot({ path: `${outDir}/after-forced-dispose.png` });
console.log("REMOUNT", JSON.stringify({ remount, after }));
await browser.close();
