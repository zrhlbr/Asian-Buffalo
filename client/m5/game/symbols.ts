/**
 * Symbol textures — commercial illustrated PNGs + premium canvas fallbacks.
 * Formal SymbolId set unchanged (math/server authoritative).
 */
import * as THREE from "three";
import type { SymbolId } from "../adapter.ts";

// Explicit ?url — vinext/RSC may otherwise hand back module objects → "/[object Object]" 404s
import buffaloArt from "../assets/symbols/buffalo.png?url";
import lionArt from "../assets/symbols/lion.png?url";
import elephantArt from "../assets/symbols/elephant.png?url";
import antelopeArt from "../assets/symbols/antelope.png?url";
import zebraArt from "../assets/symbols/zebra.png?url";
import wildArt from "../assets/symbols/wild.png?url";
import scatterArt from "../assets/symbols/scatter.png?url";
import aArt from "../assets/symbols/a.png?url";
import kArt from "../assets/symbols/k.png?url";
import qArt from "../assets/symbols/q.png?url";
import jArt from "../assets/symbols/j.png?url";
import tenArt from "../assets/symbols/ten.png?url";
import nineArt from "../assets/symbols/nine.png?url";

/** Runtime plate resolution — M8 Phase3: 1024 minimum (never downscale commercial PNGs to 512). */
const SIZE = 1024;
/** Logical size for procedural fallback painters (scaled up onto SIZE). */
const LOGIC = 512;

function asAssetUrl(mod: unknown): string {
  if (typeof mod === "string") return mod;
  if (mod && typeof mod === "object" && "default" in (mod as object)) {
    const d = (mod as { default: unknown }).default;
    if (typeof d === "string") return d;
  }
  return String(mod ?? "");
}

const ART_URL: Partial<Record<SymbolId, string>> = {
  buffalo: asAssetUrl(buffaloArt),
  lion: asAssetUrl(lionArt),
  elephant: asAssetUrl(elephantArt),
  antelope: asAssetUrl(antelopeArt),
  zebra: asAssetUrl(zebraArt),
  wild: asAssetUrl(wildArt),
  scatter: asAssetUrl(scatterArt),
  a: asAssetUrl(aArt),
  k: asAssetUrl(kArt),
  q: asAssetUrl(qArt),
  j: asAssetUrl(jArt),
  ten: asAssetUrl(tenArt),
  nine: asAssetUrl(nineArt),
};

function makeCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const g = c.getContext("2d", { alpha: true })!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  return [c, g];
}

/** Shared crisp sampling — anisotropy follows GPU cap; mipmaps on. */
export function configureSymbolTexture(
  tex: THREE.Texture,
  maxAniso = 16,
): THREE.Texture {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function jewelTile(g: CanvasRenderingContext2D, top: string, bottom: string): void {
  const grad = g.createLinearGradient(0, 0, 0, LOGIC);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, bottom);
  grad.addColorStop(1, "#0a0602");
  g.fillStyle = grad;
  roundRect(g, 10, 10, LOGIC - 20, LOGIC - 20, 42);
  g.fill();
  // metal rim
  const rim = g.createLinearGradient(0, 0, LOGIC, LOGIC);
  rim.addColorStop(0, "rgba(255,240,180,.95)");
  rim.addColorStop(0.45, "rgba(224,179,74,.9)");
  rim.addColorStop(1, "rgba(90,60,16,.95)");
  g.strokeStyle = rim;
  g.lineWidth = 14;
  roundRect(g, 18, 18, LOGIC - 36, LOGIC - 36, 36);
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,.18)";
  g.lineWidth = 3;
  roundRect(g, 34, 34, LOGIC - 68, LOGIC - 68, 28);
  g.stroke();
}

function letter(g: CanvasRenderingContext2D, ch: string, c1: string, c2: string): void {
  jewelTile(g, "#3b2810", "#140c05");
  g.font = `900 ${ch.length > 1 ? 210 : 280}px Cinzel, Georgia, serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const grad = g.createLinearGradient(0, 90, 0, 400);
  grad.addColorStop(0, "#fff8df");
  grad.addColorStop(0.35, c1);
  grad.addColorStop(1, c2);
  g.fillStyle = grad;
  g.shadowColor = "rgba(0,0,0,.65)";
  g.shadowBlur = 18;
  g.shadowOffsetY = 10;
  g.fillText(ch, LOGIC / 2, LOGIC / 2 + 12);
  g.shadowBlur = 0;
  // specular slash
  g.strokeStyle = "rgba(255,255,255,.22)";
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(120, 110);
  g.lineTo(200, 90);
  g.stroke();
}

function drawZebraFallback(g: CanvasRenderingContext2D): void {
  jewelTile(g, "#2a2118", "#0e0a06");
  g.save();
  g.translate(LOGIC / 2, LOGIC / 2 + 10);
  g.fillStyle = "#f2e6cf";
  g.beginPath();
  g.ellipse(0, 20, 120, 100, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1a120c";
  for (let i = -4; i <= 4; i++) {
    g.beginPath();
    g.ellipse(i * 22, -10, 10, 70, i * 0.08, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#120c08";
  g.beginPath();
  g.ellipse(0, -70, 70, 55, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Commercial buffalo plate — no logo text; warm key from upper-left. */
function drawBuffaloSymbol(g: CanvasRenderingContext2D): void {
  jewelTile(g, "#4a2a0c", "#120804");
  const sky = g.createRadialGradient(340, 160, 20, 256, 220, 280);
  sky.addColorStop(0, "#ffb040");
  sky.addColorStop(0.45, "#c45a18");
  sky.addColorStop(1, "#1a0c04");
  g.fillStyle = sky;
  roundRect(g, 28, 28, LOGIC - 56, LOGIC - 56, 36);
  g.fill();

  g.save();
  g.translate(LOGIC / 2, LOGIC / 2 + 18);
  // Crescent horns (Asian water buffalo silhouette)
  const horn = (dir: 1 | -1) => {
    g.fillStyle = "#1a120c";
    g.beginPath();
    g.moveTo(dir * 40, -40);
    g.bezierCurveTo(dir * 150, -120, dir * 210, -40, dir * 170, 30);
    g.bezierCurveTo(dir * 150, -10, dir * 110, -50, dir * 48, -28);
    g.closePath();
    g.fill();
    g.strokeStyle = "rgba(255, 210, 120, 0.35)";
    g.lineWidth = 4;
    g.stroke();
  };
  horn(-1);
  horn(1);
  // Head mass
  const head = g.createLinearGradient(-80, -60, 80, 120);
  head.addColorStop(0, "#5a3a22");
  head.addColorStop(0.45, "#2a1810");
  head.addColorStop(1, "#120a06");
  g.fillStyle = head;
  g.beginPath();
  g.ellipse(0, 20, 118, 128, 0, 0, Math.PI * 2);
  g.fill();
  // Muzzle
  g.fillStyle = "#1c120c";
  g.beginPath();
  g.ellipse(0, 88, 72, 48, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#0a0604";
  g.beginPath();
  g.ellipse(-22, 78, 16, 12, 0, 0, Math.PI * 2);
  g.ellipse(22, 78, 16, 12, 0, 0, Math.PI * 2);
  g.fill();
  // Eyes + catchlight (upper-left key)
  for (const ex of [-38, 38]) {
    g.fillStyle = "#3a2414";
    g.beginPath();
    g.ellipse(ex, -10, 18, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f0c070";
    g.beginPath();
    g.ellipse(ex - 3, -12, 5, 5, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Ear tips
  g.fillStyle = "#2a1810";
  g.beginPath();
  g.ellipse(-95, -20, 28, 40, -0.4, 0, Math.PI * 2);
  g.ellipse(95, -20, 28, 40, 0.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Formal SymbolId painters (fallback when PNG missing/unloadable). */
const PAINTERS: Record<SymbolId, (g: CanvasRenderingContext2D) => void> = {
  buffalo: drawBuffaloSymbol,
  lion: (g) => jewelTile(g, "#5a2e10", "#1c1006"),
  elephant: (g) => jewelTile(g, "#3a3a48", "#14141c"),
  zebra: drawZebraFallback,
  antelope: (g) => jewelTile(g, "#3a4a28", "#12180c"),
  a: (g) => letter(g, "A", "#ffe98a", "#c98f1f"),
  k: (g) => letter(g, "K", "#ffd2a0", "#c26a1f"),
  q: (g) => letter(g, "Q", "#e8c0ff", "#8a4fc2"),
  j: (g) => letter(g, "J", "#a0d8ff", "#2f6ec2"),
  ten: (g) => letter(g, "10", "#b0f0c0", "#2f9e5a"),
  nine: (g) => letter(g, "9", "#c0e8ff", "#3a7a9e"),
  wild: (g) => letter(g, "WILD", "#ffe98a", "#c98f1f"),
  scatter: (g) => letter(g, "SC", "#ffe98a", "#c98f1f"),
};

const textureCache = new Map<SymbolId, THREE.Texture>();
const canvasCache = new Map<SymbolId, HTMLCanvasElement>();
const pending = new Map<SymbolId, Promise<void>>();

function paintFallback(id: SymbolId): HTMLCanvasElement {
  let c = canvasCache.get(id);
  if (!c) {
    const [canvas, g] = makeCanvas();
    g.save();
    g.scale(SIZE / LOGIC, SIZE / LOGIC);
    PAINTERS[id](g);
    g.restore();
    canvasCache.set(id, canvas);
    c = canvas;
  }
  return c;
}

async function ensureArt(id: SymbolId): Promise<void> {
  const url = ART_URL[id];
  if (!url || canvasCache.has(id)) return;
  let job = pending.get(id);
  if (!job) {
    job = new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const [canvas, g] = makeCanvas();
        // M8 commercial 3D symbols already include metal frames — keep plate light
        g.fillStyle = "#0a0603";
        g.fillRect(0, 0, SIZE, SIZE);
        const pad = 10;
        g.save();
        roundRect(g, pad, pad, SIZE - pad * 2, SIZE - pad * 2, 28);
        g.clip();
        g.drawImage(img, pad, pad, SIZE - pad * 2, SIZE - pad * 2);
        // warm key-light wash (unify light direction across the set)
        const wash = g.createLinearGradient(0, pad, 0, SIZE - pad);
        wash.addColorStop(0, "rgba(255, 230, 160, 0.10)");
        wash.addColorStop(0.5, "rgba(180, 120, 255, 0.03)");
        wash.addColorStop(1, "rgba(20, 8, 0, 0.18)");
        g.fillStyle = wash;
        g.fillRect(pad, pad, SIZE - pad * 2, SIZE - pad * 2);
        // subtle contact AO at bottom edge (thickness read)
        const ao = g.createLinearGradient(0, SIZE * 0.72, 0, SIZE - pad);
        ao.addColorStop(0, "rgba(0,0,0,0)");
        ao.addColorStop(1, "rgba(0,0,0,0.28)");
        g.fillStyle = ao;
        g.fillRect(pad, SIZE * 0.72, SIZE - pad * 2, SIZE * 0.28 - pad);
        g.restore();
        // outer specular rim — black-gold unify
        const rim = g.createLinearGradient(0, 0, SIZE, SIZE);
        rim.addColorStop(0, "rgba(255, 245, 200, 0.9)");
        rim.addColorStop(0.45, "rgba(224, 179, 74, 0.75)");
        rim.addColorStop(1, "rgba(40, 24, 8, 0.95)");
        g.strokeStyle = rim;
        g.lineWidth = 8;
        roundRect(g, 8, 8, SIZE - 16, SIZE - 16, 30);
        g.stroke();
        canvasCache.set(id, canvas);
        // refresh texture if already created from fallback
        const existing = textureCache.get(id);
        if (existing instanceof THREE.CanvasTexture) {
          existing.image = canvas;
          existing.needsUpdate = true;
        }
        resolve();
      };
      img.onerror = () => {
        paintFallback(id);
        resolve();
      };
      img.src = url;
    });
    pending.set(id, job);
  }
  await job;
}

/** Kick off commercial art preload; resolves when all PNG slots settle (or fail). */
export function preloadSymbolArt(): Promise<void> {
  const ids = Object.keys(ART_URL) as SymbolId[];
  return Promise.all(ids.map((id) => ensureArt(id))).then(() => undefined);
}

export function symbolCanvas(id: SymbolId): HTMLCanvasElement {
  void ensureArt(id);
  return canvasCache.get(id) ?? paintFallback(id);
}

let maxAnisotropy = 16;

/** Call once from World with renderer.capabilities.getMaxAnisotropy(). */
export function setSymbolMaxAnisotropy(n: number): void {
  maxAnisotropy = Math.max(1, Math.min(16, Math.floor(n) || 8));
  for (const tex of textureCache.values()) {
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
  }
}

export function symbolTexture(id: SymbolId): THREE.Texture {
  let tex = textureCache.get(id);
  if (!tex) {
    tex = new THREE.CanvasTexture(symbolCanvas(id));
    configureSymbolTexture(tex, maxAnisotropy);
    textureCache.set(id, tex);
    void ensureArt(id).then(() => {
      const c = canvasCache.get(id);
      if (c && tex instanceof THREE.CanvasTexture) {
        tex.image = c;
        configureSymbolTexture(tex, maxAnisotropy);
      }
    });
  }
  return tex;
}

export function symbolPlateSize(): number {
  return SIZE;
}

export const ALL_SYMBOLS: SymbolId[] = [
  "buffalo",
  "lion",
  "elephant",
  "zebra",
  "antelope",
  "a",
  "k",
  "q",
  "j",
  "ten",
  "nine",
  "wild",
  "scatter",
];
