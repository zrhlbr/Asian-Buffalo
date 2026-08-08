/**
 * Probe reel symbol visibility — presentation diagnostics only.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.AB_CAPTURE_URL || "http://127.0.0.1:5173/";
const OUT = join(process.cwd(), "docs", "m8-review", "blocker-symbols-missing");
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#btn-spin", { timeout: 45000 }).catch(() => {});
  await page
    .waitForFunction(() => document.getElementById("loading")?.classList.contains("done"), {
      timeout: 45000,
    })
    .catch(() => {});
  await sleep(2000);

  const probe = await page.evaluate(() => {
    const g = window.__game;
    if (!g?.rig) {
      return { ok: false, reason: "no __game.rig", hasGame: Boolean(g) };
    }
    const rig = g.rig;
    const reels = rig.reels || rig._reels;
    // Walk scene graph for symbol meshes
    const mats = [];
    let meshCount = 0;
    let visibleMeshes = 0;
    let shaderOk = 0;
    let shaderFail = 0;
    let basicOk = 0;
    const samples = [];
    rig.group.traverse((obj) => {
      if (!obj.isMesh) return;
      meshCount++;
      if (obj.visible) visibleMeshes++;
      const mat = obj.material;
      if (!mat) return;
      const type = mat.type || mat.constructor?.name;
      const entry = {
        type,
        visible: obj.visible,
        opacity: mat.opacity,
        transparent: mat.transparent,
        depthWrite: mat.depthWrite,
        pos: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      };
      if (type === "ShaderMaterial") {
        const u = mat.uniforms || {};
        entry.uOpacity = u.uOpacity?.value;
        entry.hasMap = Boolean(u.uMap?.value);
        entry.mapImage = Boolean(u.uMap?.value?.image);
        entry.uKind = u.uKind?.value;
        entry.program = mat.program ? "yes" : "no";
        if (u.uMap?.value?.image) shaderOk++;
        else shaderFail++;
        if (samples.length < 6) samples.push(entry);
      } else if (mat.map) {
        basicOk++;
        entry.hasMap = true;
        if (samples.length < 6) samples.push(entry);
      }
    });

    // Pixel sample center of canvas
    const canvas = document.querySelector("#gl");
    let pixel = null;
    if (canvas) {
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (gl) {
        const x = Math.floor(canvas.width / 2);
        const y = Math.floor(canvas.height / 2);
        const buf = new Uint8Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        pixel = { x, y, rgba: [...buf], cssW: canvas.clientWidth, cssH: canvas.clientHeight, bufW: canvas.width, bufH: canvas.height };
      }
    }

    return {
      ok: true,
      meshCount,
      visibleMeshes,
      shaderOk,
      shaderFail,
      basicOk,
      samples,
      pixel,
      reelScale: rig.scaleFactor,
      reelPos: { ...rig.group.position },
      state: g.state?.() ?? null,
    };
  });

  await page.screenshot({
    path: join(OUT, "before-idle.png"),
    fullPage: false,
  });

  writeFileSync(join(OUT, "probe.json"), JSON.stringify({ probe, logs: logs.slice(-80) }, null, 2));
  console.log(JSON.stringify({ probe, logTail: logs.slice(-20) }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
