import { chromium } from "playwright";
import fs from "fs";

const outDir = "docs/m8-review/blocker-blackscreen-p0";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on("console", (m) => logs.push(m.type() + ": " + m.text()));
page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message + "\n" + e.stack));
page.on("requestfailed", (r) => logs.push("REQFAIL: " + r.url() + " " + r.failure()?.errorText));

await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(5000);

const deep = await page.evaluate(() => {
  const g = window.__game;
  if (!g) return { err: "no __game" };
  const world = g.world;
  const rig = g.rig;
  const scene = world?.scene;
  const children = [];
  scene?.traverse((o) => {
    if (o.isMesh || o.isPoints || o.isGroup) {
      if (children.length < 80) {
        children.push({
          type: o.type,
          name: o.name,
          visible: o.visible,
          pos: o.position ? [o.position.x, o.position.y, o.position.z] : null,
          scale: o.scale ? [o.scale.x, o.scale.y, o.scale.z] : null,
          mat: o.material
            ? Array.isArray(o.material)
              ? o.material.map((m) => m?.type + " op=" + m?.opacity)
              : o.material.type + " op=" + o.material.opacity + " map=" + !!o.material.map
            : null,
        });
      }
    }
  });
  // Force one render and sample via renderer
  try {
    world.render();
  } catch (e) {
    return { err: "render failed " + e, stack: String(e?.stack || e) };
  }
  const renderer = world.renderer;
  const gl = renderer.getContext();
  const w = 32, h = 32;
  const data = new Uint8Array(w * h * 4);
  // read center of drawing buffer
  const dbw = gl.drawingBufferWidth;
  const dbh = gl.drawingBufferHeight;
  gl.readPixels(Math.floor(dbw/2 - w/2), Math.floor(dbh/2 - h/2), w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
  let sum=0, nz=0, max=0;
  for (let i=0;i<data.length;i++){ sum+=data[i]; if(data[i]>0) nz++; if(data[i]>max) max=data[i]; }
  // also read corner
  const data2 = new Uint8Array(16);
  gl.readPixels(0, 0, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, data2);

  // tile opacity sample
  const reel0 = rig?.reels?.[0] || rig?.["reels"]?.[0];
  let tileInfo = null;
  try {
    // reels may be private — walk rig.group
    const meshes = [];
    rig.group.traverse((o) => {
      if (o.isMesh && o.material?.map) meshes.push(o);
    });
    const m = meshes[2];
    tileInfo = {
      meshCount: meshes.length,
      sample: m ? {
        visible: m.visible,
        opacity: m.material.opacity,
        color: m.material.color?.getHexString?.(),
        mapImage: !!(m.material.map?.image?.width),
        mapW: m.material.map?.image?.width,
        mapH: m.material.map?.image?.height,
        pos: [m.position.x, m.position.y, m.position.z],
        scale: [m.scale.x, m.scale.y, m.scale.z],
        parentScale: m.parent ? [m.parent.scale.x, m.parent.scale.y, m.parent.scale.z] : null,
      } : null,
      groupPos: [rig.group.position.x, rig.group.position.y, rig.group.position.z],
      groupScale: [rig.group.scale.x, rig.group.scale.y, rig.group.scale.z],
      groupVisible: rig.group.visible,
    };
  } catch (e) {
    tileInfo = { err: String(e) };
  }

  return {
    disposed: world.disposed,
    sceneChildren: scene?.children?.length,
    children,
    pixelsCenter: { avg: sum/data.length, nz, max, sample: Array.from(data.slice(0,12)) },
    pixelsCorner: Array.from(data2),
    db: { dbw, dbh },
    tileInfo,
    cam: {
      pos: world.camera.position.toArray(),
      fov: world.camera.fov,
      near: world.camera.near,
      far: world.camera.far,
      aspect: world.camera.aspect,
    },
    clear: (() => { const c = new (window.THREE?.Color || Object)(); try { renderer.getClearColor(c); return c; } catch { return renderer.getClearColor?.()?.getHexString?.() ?? "n/a"; } })(),
  };
});

fs.writeFileSync(outDir + "/deep-probe.json", JSON.stringify({ deep, logs: logs.filter(l => l.startsWith("error") || l.startsWith("PAGE") || l.includes("WebGL") || l.includes("THREE")).slice(0,50) }, null, 2));
console.log(JSON.stringify({ deep, errLogs: logs.filter(l => l.startsWith("error") || l.startsWith("PAGE") || l.includes("THREE")).slice(0,50) }, null, 2));

// Crop center of screenshot for brightness analysis via CDP
const shot = await page.screenshot({ path: outDir + "/before-idle-2.png" });
// sample PNG middle bytes crudely via canvas in page from screenshot? instead use page.evaluate screenshot of canvas toDataURL
const dataUrl = await page.evaluate(() => {
  const c = document.getElementById("gl");
  return c.toDataURL("image/png").slice(0, 100) + "...len=" + c.toDataURL("image/png").length;
});
const brightness = await page.evaluate(() => {
  const src = document.getElementById("gl");
  const c = document.createElement("canvas");
  c.width = 160; c.height = 90;
  const ctx = c.getContext("2d");
  ctx.drawImage(src, 0, 0, 160, 90);
  const img = ctx.getImageData(0, 0, 160, 90).data;
  let sum=0, nz=0, max=0;
  for (let i=0;i<img.length;i+=4) {
    const v = (img[i]+img[i+1]+img[i+2])/3;
    sum += v; if (v>5) nz++; if (v>max) max=v;
  }
  return { avg: sum/(img.length/4), nz, max, total: img.length/4 };
});
console.log("CANVAS_TODATA", dataUrl);
console.log("BRIGHTNESS", JSON.stringify(brightness));
await browser.close();
