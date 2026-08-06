/**
 * Symbol textures — hand-drawn on canvas (no external art assets).
 * One texture per symbol; shared by reel cells and paytable UI.
 */
import * as THREE from "three";
import type { SymbolId } from "../adapter.ts";

const SIZE = 256;

function makeCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  return [c, c.getContext("2d")!];
}

function baseTile(g: CanvasRenderingContext2D, top: string, bottom: string): void {
  const grad = g.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  roundRect(g, 6, 6, SIZE - 12, SIZE - 12, 26);
  g.fill();
  // inner gold frame
  g.strokeStyle = "rgba(249,224,138,.85)";
  g.lineWidth = 5;
  roundRect(g, 10, 10, SIZE - 20, SIZE - 20, 22);
  g.stroke();
  g.strokeStyle = "rgba(90,60,10,.9)";
  g.lineWidth = 2;
  roundRect(g, 18, 18, SIZE - 36, SIZE - 36, 16);
  g.stroke();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function letter(g: CanvasRenderingContext2D, ch: string, color1: string, color2: string): void {
  baseTile(g, "#3a2a12", "#1c1206");
  g.font = `900 ${ch.length > 1 ? 110 : 150}px Georgia, serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const grad = g.createLinearGradient(0, 50, 0, 210);
  grad.addColorStop(0, color1);
  grad.addColorStop(1, color2);
  g.fillStyle = grad;
  g.shadowColor = "rgba(0,0,0,.6)";
  g.shadowBlur = 10;
  g.shadowOffsetY = 6;
  g.fillText(ch, SIZE / 2, SIZE / 2 + 8);
}

function drawBuffalo(g: CanvasRenderingContext2D): void {
  baseTile(g, "#4a3413", "#211405");
  g.save();
  g.translate(SIZE / 2, SIZE / 2 + 14);
  // body silhouette
  g.fillStyle = "#2b1c0d";
  g.beginPath();
  g.ellipse(0, 26, 74, 44, 0, 0, Math.PI * 2);
  g.fill();
  // hump
  g.beginPath();
  g.ellipse(-8, -2, 52, 34, 0, Math.PI, 0);
  g.fill();
  // head
  g.fillStyle = "#33220f";
  g.beginPath();
  g.ellipse(0, -34, 34, 30, 0, 0, Math.PI * 2);
  g.fill();
  // horns
  g.strokeStyle = "#d9c27a";
  g.lineWidth = 11;
  g.lineCap = "round";
  g.beginPath(); g.arc(-32, -48, 26, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
  g.beginPath(); g.arc(32, -48, 26, Math.PI * 1.1, Math.PI * 0.1, true); g.stroke();
  // boss (horn base)
  g.fillStyle = "#c9ad5e";
  g.beginPath(); g.ellipse(0, -52, 24, 12, 0, 0, Math.PI * 2); g.fill();
  // eyes
  g.fillStyle = "#ffd970";
  g.beginPath(); g.arc(-13, -36, 5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(13, -36, 5, 0, Math.PI * 2); g.fill();
  // muzzle
  g.fillStyle = "#1c1108";
  g.beginPath(); g.ellipse(0, -16, 20, 12, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  // rim light
  g.strokeStyle = "rgba(255,214,110,.55)";
  g.lineWidth = 4;
  g.beginPath(); g.ellipse(SIZE / 2, SIZE / 2 + 12, 82, 58, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
}

function drawEagle(g: CanvasRenderingContext2D): void {
  baseTile(g, "#3d2f16", "#191006");
  g.save();
  g.translate(SIZE / 2, SIZE / 2);
  g.fillStyle = "#c99b3f";
  // wings
  g.beginPath();
  g.moveTo(0, -10);
  g.quadraticCurveTo(-60, -70, -96, -46);
  g.quadraticCurveTo(-58, -30, -52, 6);
  g.quadraticCurveTo(-26, -6, 0, 4);
  g.quadraticCurveTo(26, -6, 52, 6);
  g.quadraticCurveTo(58, -30, 96, -46);
  g.quadraticCurveTo(60, -70, 0, -10);
  g.fill();
  // body/head
  g.fillStyle = "#e8c26a";
  g.beginPath(); g.ellipse(0, 8, 20, 30, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff3c4";
  g.beginPath(); g.arc(0, -22, 14, 0, Math.PI * 2); g.fill();
  // beak
  g.fillStyle = "#f39c2b";
  g.beginPath(); g.moveTo(-6, -22); g.lineTo(10, -18); g.lineTo(-4, -12); g.closePath(); g.fill();
  // eye
  g.fillStyle = "#241503";
  g.beginPath(); g.arc(-4, -26, 3.4, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawTiger(g: CanvasRenderingContext2D): void {
  baseTile(g, "#43300f", "#1d1204");
  g.save();
  g.translate(SIZE / 2, SIZE / 2);
  g.fillStyle = "#e08b2d";
  g.beginPath(); g.ellipse(0, 0, 62, 54, 0, 0, Math.PI * 2); g.fill();
  // ears
  g.beginPath(); g.arc(-42, -40, 16, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(42, -40, 16, 0, Math.PI * 2); g.fill();
  // stripes
  g.strokeStyle = "#2b1603";
  g.lineWidth = 7; g.lineCap = "round";
  for (const [x1, y1, x2, y2] of [[-30, -46, -18, -30], [30, -46, 18, -30], [0, -52, 0, -34], [-56, -8, -38, 0], [56, -8, 38, 0]] as const) {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  // muzzle
  g.fillStyle = "#f6d9a0";
  g.beginPath(); g.ellipse(0, 20, 30, 20, 0, 0, Math.PI * 2); g.fill();
  // eyes
  g.fillStyle = "#ffd970";
  g.beginPath(); g.ellipse(-22, -8, 9, 11, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(22, -8, 9, 11, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#201203";
  g.beginPath(); g.ellipse(-22, -8, 3.4, 8, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(22, -8, 3.4, 8, 0, 0, Math.PI * 2); g.fill();
  // nose
  g.fillStyle = "#8a3b1e";
  g.beginPath(); g.moveTo(-7, 10); g.lineTo(7, 10); g.lineTo(0, 19); g.closePath(); g.fill();
  g.restore();
}

function drawDeer(g: CanvasRenderingContext2D): void {
  baseTile(g, "#3b2c14", "#1a1106");
  g.save();
  g.translate(SIZE / 2, SIZE / 2 + 6);
  g.fillStyle = "#b07f3e";
  g.beginPath(); g.ellipse(0, 10, 38, 46, 0, 0, Math.PI * 2); g.fill();
  // antlers
  g.strokeStyle = "#e6cf9a"; g.lineWidth = 8; g.lineCap = "round";
  const antler = (sx: number) => {
    g.beginPath(); g.moveTo(sx * 14, -40);
    g.quadraticCurveTo(sx * 34, -72, sx * 22, -92); g.stroke();
    g.beginPath(); g.moveTo(sx * 26, -62); g.lineTo(sx * 48, -74); g.stroke();
    g.beginPath(); g.moveTo(sx * 20, -78); g.lineTo(sx * 38, -96); g.stroke();
  };
  antler(-1); antler(1);
  // ears
  g.fillStyle = "#96662a";
  g.beginPath(); g.ellipse(-30, -22, 14, 8, -0.7, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(30, -22, 14, 8, 0.7, 0, Math.PI * 2); g.fill();
  // eyes
  g.fillStyle = "#241503";
  g.beginPath(); g.arc(-14, -6, 5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(14, -6, 5, 0, Math.PI * 2); g.fill();
  // muzzle
  g.fillStyle = "#8a5f27";
  g.beginPath(); g.ellipse(0, 30, 16, 14, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#2b1a08";
  g.beginPath(); g.ellipse(0, 24, 7, 5, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawLotus(g: CanvasRenderingContext2D): void {
  baseTile(g, "#3a2b14", "#191006");
  g.save();
  g.translate(SIZE / 2, SIZE / 2 + 16);
  const petal = (rot: number, len: number, w: number, col: string) => {
    g.save(); g.rotate(rot);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-w, -len * 0.55, 0, -len);
    g.quadraticCurveTo(w, -len * 0.55, 0, 0);
    g.fill(); g.restore();
  };
  for (let i = -2; i <= 2; i++) petal(i * 0.5, 78 - Math.abs(i) * 16, 26, i % 2 === 0 ? "#f2c94c" : "#d4af37");
  petal(0, 92, 22, "#ffe98a");
  // base leaves
  g.fillStyle = "#7a8a3a";
  g.beginPath(); g.ellipse(-34, 18, 26, 10, -0.3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(34, 18, 26, 10, 0.3, 0, Math.PI * 2); g.fill();
  // glow center
  g.fillStyle = "#fff3c4";
  g.beginPath(); g.arc(0, -6, 10, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawWild(g: CanvasRenderingContext2D): void {
  baseTile(g, "#6b2f0e", "#2a1004");
  const cx = SIZE / 2, cy = SIZE / 2 - 20;
  // sunset
  const sun = g.createRadialGradient(cx, cy, 8, cx, cy, 74);
  sun.addColorStop(0, "#fff3c4");
  sun.addColorStop(0.5, "#f9b84a");
  sun.addColorStop(1, "rgba(230,110,30,0)");
  g.fillStyle = sun;
  g.beginPath(); g.arc(cx, cy, 74, 0, Math.PI * 2); g.fill();
  // horizon line
  g.fillStyle = "rgba(40,16,4,.85)";
  g.fillRect(20, cy + 34, SIZE - 40, 6);
  g.font = "900 62px Georgia, serif";
  g.textAlign = "center";
  const grad = g.createLinearGradient(0, SIZE - 92, 0, SIZE - 30);
  grad.addColorStop(0, "#fff6d8"); grad.addColorStop(1, "#f9b84a");
  g.fillStyle = grad;
  g.shadowColor = "rgba(255,180,60,.9)"; g.shadowBlur = 16;
  g.fillText("WILD", cx, SIZE - 42);
  g.shadowBlur = 0;
}

function drawScatter(g: CanvasRenderingContext2D): void {
  baseTile(g, "#4a3413", "#201404");
  const cx = SIZE / 2, cy = SIZE / 2 - 8;
  // gold coin
  const coin = g.createRadialGradient(cx - 18, cy - 22, 10, cx, cy, 70);
  coin.addColorStop(0, "#fff6d8");
  coin.addColorStop(0.55, "#f2c94c");
  coin.addColorStop(1, "#9a7418");
  g.fillStyle = coin;
  g.beginPath(); g.arc(cx, cy, 66, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#7a5a10"; g.lineWidth = 6;
  g.beginPath(); g.arc(cx, cy, 54, 0, Math.PI * 2); g.stroke();
  // buffalo head stamp
  g.fillStyle = "#5c430e";
  g.beginPath(); g.ellipse(cx, cy + 4, 26, 22, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#5c430e"; g.lineWidth = 7; g.lineCap = "round";
  g.beginPath(); g.arc(cx - 18, cy - 12, 14, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
  g.beginPath(); g.arc(cx + 18, cy - 12, 14, Math.PI * 1.1, Math.PI * 0.1, true); g.stroke();
  g.font = "900 34px Georgia, serif";
  g.textAlign = "center";
  g.fillStyle = "#ffe98a";
  g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 6;
  g.fillText("SCATTER", cx, SIZE - 36);
  g.shadowBlur = 0;
}

/** Formal SymbolId painters (5×4 / 50-line set). Legacy prototype art remapped. */
const PAINTERS: Record<SymbolId, (g: CanvasRenderingContext2D) => void> = {
  buffalo: drawBuffalo,
  lion: drawTiger,
  elephant: drawDeer,
  zebra: drawEagle,
  antelope: drawLotus,
  a: (g) => letter(g, "A", "#ffe98a", "#c98f1f"),
  k: (g) => letter(g, "K", "#ffd2a0", "#c26a1f"),
  q: (g) => letter(g, "Q", "#e8c0ff", "#8a4fc2"),
  j: (g) => letter(g, "J", "#a0d8ff", "#2f6ec2"),
  ten: (g) => letter(g, "10", "#b0f0c0", "#2f9e5a"),
  nine: (g) => letter(g, "9", "#c0e8ff", "#3a7a9e"),
  wild: drawWild,
  scatter: drawScatter,
};

const textureCache = new Map<SymbolId, THREE.CanvasTexture>();
const canvasCache = new Map<SymbolId, HTMLCanvasElement>();

export function symbolCanvas(id: SymbolId): HTMLCanvasElement {
  let c = canvasCache.get(id);
  if (!c) {
    const [canvas, g] = makeCanvas();
    PAINTERS[id](g);
    canvasCache.set(id, canvas);
    c = canvas;
  }
  return c;
}

export function symbolTexture(id: SymbolId): THREE.CanvasTexture {
  let tex = textureCache.get(id);
  if (!tex) {
    tex = new THREE.CanvasTexture(symbolCanvas(id));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    textureCache.set(id, tex);
  }
  return tex;
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
