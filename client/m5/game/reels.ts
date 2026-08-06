/**
 * Reels — 5×4 reel rig rendered as textured planes inside a gold 3D frame.
 * Spin: staggered ease-out per reel, texture cycling, speed stretch, landing bounce.
 */
import * as THREE from "three";
import { REELS, ROWS, type SymbolId } from "../adapter.ts";
import { symbolTexture, ALL_SYMBOLS } from "./symbols.ts";

const CELL = 1.12;
const GAP = 0.02;

function cellY(r: number, frac: number): number {
  return (ROWS / 2 - 0.5 - r + frac) * (CELL + GAP);
}

class Reel {
  readonly index: number;
  readonly group = new THREE.Group();
  private cells: THREE.Mesh[] = [];
  private seq: SymbolId[] = [];
  private pos = 0;           // absolute position in cells
  private distance = 0;
  private t = 0;
  private duration = 1;
  private spinning = false;
  private bounceT = -1;
  private lastTex: THREE.Texture[] = [];
  private resolver: (() => void) | null = null;
  onStop: ((index: number) => void) | null = null;

  constructor(index: number) {
    this.index = index;
    const geo = new THREE.PlaneGeometry(CELL, CELL);
    for (let k = 0; k < ROWS + 2; k++) {
      const mat = new THREE.MeshBasicMaterial({ map: symbolTexture("buffalo") });
      const m = new THREE.Mesh(geo, mat);
      this.cells.push(m);
      this.lastTex.push(mat.map!);
      this.group.add(m);
    }
    // idle grid
    const idle: SymbolId[] = [];
    for (let r = 0; r < ROWS; r++) idle.push(ALL_SYMBOLS[Math.floor(Math.random() * 10)]);
    this.setGrid(idle);
  }

  setGrid(col: SymbolId[]): void {
    this.spinning = false;
    this.seq = [...col];
    this.pos = 0;
    this.distance = 0;
    this.t = 0;
    this.layout();
  }

  spin(target: SymbolId[], duration: number): Promise<void> {
    const rnd = (): SymbolId => ALL_SYMBOLS[Math.floor(Math.random() * 10)];
    const prefix: SymbolId[] = [];
    const prefixLen = 6 + this.index * 2;
    for (let i = 0; i < prefixLen; i++) prefix.push(rnd());
    this.distance = prefixLen;
    this.seq = [...prefix, ...target];
    this.pos = 0;
    this.t = 0;
    this.duration = duration;
    this.spinning = true;
    this.bounceT = -1;
    return new Promise((res) => { this.resolver = res; });
  }

  get isSpinning(): boolean { return this.spinning; }

  update(dt: number): void {
    if (this.spinning) {
      this.t = Math.min(this.t + dt / this.duration, 1);
      // ease-out quart: fast spin, smooth landing
      const e = 1 - Math.pow(1 - this.t, 4);
      this.pos = e * this.distance;
      if (this.t >= 1) {
        this.spinning = false;
        this.pos = this.distance;
        this.bounceT = 0;
        this.onStop?.(this.index);
        const r = this.resolver;
        this.resolver = null;
        r?.();
      }
      this.layout();
    } else if (this.bounceT >= 0) {
      this.bounceT += dt;
      const p = this.bounceT / 0.28;
      if (p >= 1) {
        this.bounceT = -1;
        this.layout(0);
      } else {
        this.layout(-0.16 * Math.sin(p * Math.PI));
      }
    }
  }

  private layout(extraFrac = 0): void {
    const base = Math.floor(this.pos);
    const frac = this.pos - base + extraFrac;
    const speedStretch = this.spinning ? 1 + Math.sin(Math.min(this.t * 3, Math.PI)) * 0.22 : 1;
    const halfWindow = (ROWS * (CELL + GAP)) / 2; // cells outside the gold frame fade out
    for (let k = 0; k < ROWS + 2; k++) {
      const r = k - 1; // display row (-1..ROWS)
      const idx = Math.min(Math.max(base + r, 0), this.seq.length - 1);
      const sym = this.seq[idx];
      const mesh = this.cells[k];
      mesh.position.y = cellY(r, frac);
      mesh.scale.y = speedStretch;
      const fade = Math.min(Math.max((halfWindow + 0.42 - Math.abs(mesh.position.y)) / 0.6, 0), 1);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.transparent = true;
      mat.opacity = fade;
      mesh.visible = fade > 0.02;
      const tex = symbolTexture(sym);
      if (this.lastTex[k] !== tex) {
        mat.map = tex;
        this.lastTex[k] = tex;
      }
    }
  }

  /** pulse the cell at display row r */
  setCellHighlight(r: number, on: boolean): void {
    const mesh = this.cells[r + 1];
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.setScalar(on ? 1.6 : 1);
  }
}

export class ReelRig {
  readonly group = new THREE.Group();
  private reels: Reel[] = [];
  private highlights: THREE.Mesh[] = [];
  onReelStop: ((index: number) => void) | null = null;

  constructor() {
    const W = REELS * (CELL + GAP) + 0.35;
    const H = ROWS * (CELL + GAP) + 0.35;

    // backdrop
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshStandardMaterial({
        color: 0x140d05,
        roughness: 0.85,
        transparent: true,
        opacity: 0.92,
      }),
    );
    backdrop.position.z = -0.12;
    backdrop.receiveShadow = true;
    this.group.add(backdrop);

    // gold frame
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.3,
      emissive: 0x6a4d10,
      emissiveIntensity: 0.55,
    });
    const mk = (w: number, h: number, x: number, y: number) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), goldMat);
      b.position.set(x, y, -0.05);
      b.castShadow = true;
      this.group.add(b);
    };
    const th = 0.16;
    mk(W + th * 2, th, 0, H / 2 + th / 2);
    mk(W + th * 2, th, 0, -H / 2 - th / 2);
    mk(th, H, -W / 2 - th / 2, 0);
    mk(th, H, W / 2 + th / 2, 0);
    // reel dividers
    for (let i = 1; i < REELS; i++) {
      const x = -W / 2 + 0.175 + i * (CELL + GAP) - GAP / 2;
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.045, H, 0.1), goldMat);
      d.position.set(x, 0, -0.06);
      this.group.add(d);
    }
    // corner ornaments
    for (const [sx, sy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), goldMat);
      orb.position.set(sx * (W / 2 + th / 2), sy * (H / 2 + th / 2), 0.02);
      this.group.add(orb);
    }

    // reels
    for (let i = 0; i < REELS; i++) {
      const reel = new Reel(i);
      reel.group.position.x = (i - (REELS - 1) / 2) * (CELL + GAP);
      reel.onStop = (idx) => this.onReelStop?.(idx);
      this.reels.push(reel);
      this.group.add(reel.group);
    }

    this.group.position.set(0.9, 2.62, 0);
  }

  /** landscape: rig right-of-center beside the buffalo; portrait: centered */
  setAspect(aspect: number): void {
    this.group.position.x = aspect >= 1.15 ? 0.9 : 0;
  }

  setGrid(grid: SymbolId[][]): void {
    for (let i = 0; i < REELS; i++) this.reels[i].setGrid(grid[i]);
  }

  /** spin all reels; resolves when the last reel lands */
  spinAll(grid: SymbolId[][], turbo: boolean): Promise<void> {
    const base = turbo ? 0.45 : 1.15;
    const step = turbo ? 0.14 : 0.38;
    const jobs = this.reels.map((reel, i) => reel.spin(grid[i], base + i * step));
    return Promise.all(jobs).then(() => undefined);
  }

  get anySpinning(): boolean {
    return this.reels.some((r) => r.isSpinning);
  }

  highlightCells(cells: Array<[number, number]>): void {
    this.clearHighlights();
    for (const [reel, row] of cells) {
      if (this.reels[reel]) this.reels[reel].setCellHighlight(row, true);
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 1.05, CELL * 1.05),
        new THREE.MeshBasicMaterial({
          color: 0xffd970,
          transparent: true,
          opacity: 0.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glow.position.set(
        (reel - (REELS - 1) / 2) * (CELL + GAP),
        cellY(row, 0),
        -0.08,
      );
      glow.userData.pulse = true;
      this.highlights.push(glow);
      this.group.add(glow);
    }
  }

  clearHighlights(): void {
    for (const reel of this.reels) {
      for (let r = 0; r < ROWS; r++) reel.setCellHighlight(r, false);
    }
    for (const h of this.highlights) this.group.remove(h);
    this.highlights = [];
  }

  update(dt: number, time: number): void {
    for (const reel of this.reels) reel.update(dt);
    for (const h of this.highlights) {
      const mat = h.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.18 + 0.14 * Math.sin(time * 7);
    }
  }
}
