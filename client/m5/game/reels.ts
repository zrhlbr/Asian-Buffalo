/**
 * Reels — 5×4 commercial rig (M8).
 * P0: full-bleed mobile width — frame left/right near screen edges.
 * Spin direction (mandatory): TOP → BOTTOM (symbols enter from above, exit below).
 * Spin: staggered ease-out, texture cycling, speed stretch, landing bounce.
 */
import * as THREE from "three";
import { REELS, ROWS, type SymbolId } from "../adapter.ts";
import { symbolTexture, ALL_SYMBOLS } from "./symbols.ts";
import {
  createSymbolMaterial,
  lifeSpeciesOf,
  setSymbolMap,
  symbolAnimKind,
  symbolPhase,
  symbolSeed,
  triggerSymbolWinAccent,
  updateSymbolLife,
  type SymbolAnimIntensity,
  type SymbolTileMaterial,
} from "./symbol-life.ts";
import {
  spinMotionProgress,
  spinStripDistance,
  spinTimingProfile,
} from "./reel-timing.ts";

export {
  NORMAL_SPIN_TOTAL_MS,
  NORMAL_REEL_STOP_MS,
  TURBO_SPIN_TOTAL_MS,
  TURBO_REEL_STOP_MS,
  SPIN_SPEED_MULT,
  spinTimingProfile,
  spinMotionProgress,
  spinStripDistance,
} from "./reel-timing.ts";

const CELL = 1.12;
const GAP = 0.02;
const FRAME_PAD = 0.28;
/** Slim edge trim — thick rails are misread as side gutters on phones. */
const OUTER_RAIL = 0.14;

/** Visual spin axis — always downward for normal / turbo / auto / free spin. */
export const REEL_SPIN_DIRECTION = "down" as const;

/** Soft-restore window after bounce — full sharpness within ~0.15s. */
export const SHARP_RESTORE_SEC = 0.15;

/** Unscaled half-width of the commercial metal frame (world units). */
export function reelFrameHalfWidth(): number {
  return (REELS * (CELL + GAP) + FRAME_PAD) / 2 + OUTER_RAIL;
}

/**
 * Snap world Y so projected pixels land on integer rows when possible.
 * Used after bounce settle to avoid chronic half-pixel softness.
 */
export function pixelAlignWorldY(
  worldY: number,
  pixelsPerWorldUnit: number,
): number {
  if (!(pixelsPerWorldUnit > 0) || !Number.isFinite(worldY)) return worldY;
  return Math.round(worldY * pixelsPerWorldUnit) / pixelsPerWorldUnit;
}

/** Rest frac must be exact 0 — collapses float dust after bounce. */
export function settleSpinFrac(frac: number): number {
  return Math.abs(frac) < 1e-4 ? 0 : frac;
}

/**
 * Row r=0 is top (max Y). Positive `frac` shifts symbols downward (−Y)
 * so increasing spin position reads as top→bottom motion.
 */
export function cellY(r: number, frac: number): number {
  return (ROWS / 2 - 0.5 - r - frac) * (CELL + GAP);
}

/**
 * Strip index for downward scroll.
 * As `base` increases, new symbols enter at the top; final window shows
 * `seq` stored with the visible column reversed (see `toSpinSeq`).
 */
export function stripIndex(base: number, r: number): number {
  return base - r + (ROWS - 1);
}

/** Store column reversed so stripIndex + downward frac keeps server row0 at top when stopped. */
export function toSpinSeq(col: SymbolId[]): SymbolId[] {
  return col.slice().reverse();
}

/** Read back server-facing column (row0 top) from a spin strip window at rest. */
export function fromSpinSeqWindow(seq: SymbolId[], base: number): SymbolId[] {
  const out: SymbolId[] = [];
  for (let r = 0; r < ROWS; r++) {
    out.push(seq[stripIndex(base, r)]!);
  }
  return out;
}

class Reel {
  readonly index: number;
  readonly group = new THREE.Group();
  private cells: THREE.Mesh[] = [];
  private seq: SymbolId[] = [];
  private pos = 0;
  private distance = 0;
  private t = 0;
  private duration = 1;
  private bounceDuration = 0.3;
  private spinning = false;
  private bounceT = -1;
  /** Counts down after bounce — keeps tiles sharp while life fades back in. */
  private sharpRestore = 0;
  private lastTex: THREE.Texture[] = [];
  private winMask: boolean[] = [];
  private winAmp = 1;
  private lifeTime = 0;
  private animIntensity: SymbolAnimIntensity = 2;
  private resolver: (() => void) | null = null;
  /** Optional screen px per world unit for final pixel snap (set by ReelRig). */
  pixelsPerWorld = 0;
  onStop: ((index: number) => void) | null = null;

  constructor(index: number) {
    this.index = index;
    const geo = new THREE.PlaneGeometry(CELL, CELL);
    for (let k = 0; k < ROWS + 2; k++) {
      const tex = symbolTexture("buffalo");
      const mat = createSymbolMaterial(
        tex,
        "animal",
        symbolPhase(index, k),
        "buffalo",
        symbolSeed(index, k),
      );
      const m = new THREE.Mesh(geo, mat);
      this.cells.push(m);
      this.lastTex.push(tex);
      this.winMask.push(false);
      this.group.add(m);
    }
    const idle: SymbolId[] = [];
    for (let r = 0; r < ROWS; r++) idle.push(ALL_SYMBOLS[Math.floor(Math.random() * 10)]);
    this.setGrid(idle);
  }

  setAnimIntensity(intensity: SymbolAnimIntensity): void {
    this.animIntensity = intensity;
  }

  setWinAmp(amp: number): void {
    this.winAmp = Math.min(2, Math.max(0, amp));
  }

  setGrid(col: SymbolId[]): void {
    this.spinning = false;
    // Same strip encoding as spin stop — row0 (top) stays server order
    this.seq = toSpinSeq(col);
    this.pos = 0;
    this.distance = 0;
    this.t = 0;
    this.bounceT = -1;
    this.sharpRestore = 0;
    this.layout();
  }

  /**
   * @param target server column (row0 top) — never locally recomputed
   * @param durationSec time until hard stop (before bounce)
   * @param bounceSec overshoot settle; promise resolves after bounce
   * @param stripCells how many blur cells to traverse (speed feel)
   */
  spin(
    target: SymbolId[],
    durationSec: number,
    bounceSec = 0.3,
    stripCells?: number,
  ): Promise<void> {
    const rnd = (): SymbolId => ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)];
    const prefix: SymbolId[] = [];
    const prefixLen = Math.max(8, Math.floor(stripCells ?? spinStripDistance(this.index, 1)));
    for (let i = 0; i < prefixLen; i++) prefix.push(rnd());
    this.distance = prefixLen;
    // Prefix then reversed target — stripIndex maps stop window back to server rows
    this.seq = [...prefix, ...toSpinSeq(target)];
    this.pos = 0;
    this.t = 0;
    this.duration = Math.max(0.05, durationSec);
    this.bounceDuration = Math.max(0.05, bounceSec);
    this.spinning = true;
    this.bounceT = -1;
    this.sharpRestore = 0;
    return new Promise((res) => {
      this.resolver = res;
    });
  }

  get isSpinning(): boolean {
    return this.spinning || this.bounceT >= 0;
  }

  /** Test/helper: server-facing column currently shown (row0 = top). */
  visibleColumn(): SymbolId[] {
    const base = Math.floor(this.pos);
    return fromSpinSeqWindow(this.seq, base);
  }

  update(dt: number, time = 0): void {
    this.lifeTime = time;
    if (this.spinning) {
      this.t = Math.min(this.t + dt / this.duration, 1);
      // Accel → fast cruise → late ease-out; position only increases (downward)
      const e = spinMotionProgress(this.t);
      this.pos = e * this.distance;
      if (this.t >= 1) {
        this.spinning = false;
        this.pos = this.distance;
        this.bounceT = 0;
        this.onStop?.(this.index);
      }
      this.layout();
    } else if (this.bounceT >= 0) {
      this.bounceT += dt;
      const p = this.bounceT / this.bounceDuration;
      if (p >= 1) {
        this.bounceT = -1;
        this.sharpRestore = SHARP_RESTORE_SEC;
        this.layout(0);
        const r = this.resolver;
        this.resolver = null;
        r?.();
      } else {
        // Downward overshoot then short upward settle (not a reverse spin)
        const elastic = Math.sin(p * Math.PI) * Math.exp(-1.9 * p);
        this.layout(0.22 * elastic);
      }
    } else {
      if (this.sharpRestore > 0) {
        this.sharpRestore = Math.max(0, this.sharpRestore - dt);
      }
      // Idle life — refresh shader uniforms; positions stay pixel-stable
      this.layout();
    }
  }

  private layout(extraFrac = 0): void {
    const base = Math.floor(this.pos);
    const frac = settleSpinFrac(this.pos - base + extraFrac);
    // Motion feel while spinning; recognizable tiles (stretch capped for clarity)
    const cruise = this.spinning && this.t > 0.06 && this.t < 0.78;
    const speedStretch = this.spinning
      ? 1 + (cruise ? 0.26 : Math.sin(Math.min(this.t * 3, Math.PI)) * 0.14)
      : 1;
    const halfWindow = (ROWS * (CELL + GAP)) / 2;
    const maxIdx = Math.max(0, this.seq.length - 1);
    const atRest = !this.spinning && this.bounceT < 0;
    const spinAmt = this.spinning
      ? 1
      : this.bounceT >= 0
        ? 0.55
        : this.sharpRestore > 0
          ? this.sharpRestore / SHARP_RESTORE_SEC
          : 0;
    for (let k = 0; k < ROWS + 2; k++) {
      const r = k - 1;
      const idx = Math.min(Math.max(stripIndex(base, r), 0), maxIdx);
      const sym = this.seq[idx]!;
      const mesh = this.cells[k]!;
      // Positive frac → lower Y → top-to-bottom scroll
      let y = cellY(r, frac);
      if (atRest && frac === 0 && this.pixelsPerWorld > 0) {
        y = pixelAlignWorldY(y, this.pixelsPerWorld);
      }
      const win = this.winMask[k] === true;
      const winLevel = win ? this.winAmp : 0;
      const pop = win && atRest ? 1.06 + 0.04 * this.winAmp : 1;
      mesh.position.z = win && atRest ? 0.045 : 0;
      // Life owns scale / x / rotZ; reset x/rot before measuring fade from base Y
      mesh.position.x = 0;
      mesh.rotation.z = 0;
      const fade = Math.min(Math.max((halfWindow + 0.42 - Math.abs(y)) / 0.6, 0), 1);
      mesh.visible = fade > 0.02;
      const tex = symbolTexture(sym);
      const mat = mesh.material as SymbolTileMaterial;
      const kind = symbolAnimKind(sym);
      if (this.lastTex[k] !== tex) {
        setSymbolMap(mat, tex, kind, lifeSpeciesOf(sym));
        this.lastTex[k] = tex;
      }
      updateSymbolLife(mat, {
        time: this.lifeTime,
        opacity: fade,
        win: winLevel,
        intensity: this.animIntensity,
        spinning: spinAmt,
        tint: win ? 1.4 + 0.2 * this.winAmp : 1,
        symbolId: sym,
        mesh,
        baseScaleX: pop,
        baseScaleY: speedStretch * pop,
        basePosY: y,
      });
    }
  }

  setCellHighlight(r: number, on: boolean, winAmp = this.winAmp): void {
    const k = r + 1;
    if (k < 0 || k >= this.winMask.length) return;
    const was = this.winMask[k] === true;
    this.winMask[k] = on;
    if (on && !was) {
      const mat = this.cells[k]!.material as SymbolTileMaterial;
      triggerSymbolWinAccent(mat, winAmp);
    }
    // Apply immediately so sequential payline presentation feels snappy
    this.layout();
  }
}

export class ReelRig {
  readonly group = new THREE.Group();
  private reels: Reel[] = [];
  private highlights: THREE.Mesh[] = [];
  private glowPlane: THREE.Mesh | null = null;
  private frameGlowBoost = 0;
  private frameHalfW = reelFrameHalfWidth();
  private animIntensity: SymbolAnimIntensity = 2;
  private winAmp = 1;
  /** Current commercial scale (full-bleed). */
  scaleFactor = 1;
  onReelStop: ((index: number) => void) | null = null;

  /** Quality LOD for symbol life (presentation only; MeshBasic path). */
  setSymbolAnimIntensity(intensity: SymbolAnimIntensity): void {
    this.animIntensity = intensity;
    for (const reel of this.reels) reel.setAnimIntensity(intensity);
  }

  /** Win symbol amplify 0–2 from presentation choreography. */
  setWinAmp(amp: number): void {
    this.winAmp = Math.min(2, Math.max(0, amp));
    for (const reel of this.reels) reel.setWinAmp(this.winAmp);
  }

  /** Reel frame glow boost 0–1 during celebrations. */
  setFrameGlow(boost: number): void {
    this.frameGlowBoost = Math.min(1, Math.max(0, boost));
  }

  constructor() {
    const W = REELS * (CELL + GAP) + FRAME_PAD;
    const H = ROWS * (CELL + GAP) + FRAME_PAD;

    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshStandardMaterial({
        color: 0x100a04,
        roughness: 0.9,
        metalness: 0.15,
        transparent: true,
        opacity: 0.96,
      }),
    );
    backdrop.position.z = -0.14;
    backdrop.receiveShadow = true;
    this.group.add(backdrop);

    // Inner AO plate (contact shadow feel)
    const ao = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 0.995, H * 0.995),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    ao.position.z = -0.11;
    this.group.add(ao);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf4d88a,
      metalness: 0.99,
      roughness: 0.16,
      emissive: 0xb07820,
      emissiveIntensity: 0.95,
    });
    const midMetal = new THREE.MeshStandardMaterial({
      color: 0xc09438,
      metalness: 0.94,
      roughness: 0.26,
      emissive: 0x6a4214,
      emissiveIntensity: 0.42,
    });
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x2a1a08,
      metalness: 0.88,
      roughness: 0.38,
      emissive: 0x140e06,
      emissiveIntensity: 0.3,
    });

    const mk = (
      w: number,
      h: number,
      x: number,
      y: number,
      z = -0.05,
      d = 0.34,
      mat: THREE.Material = goldMat,
    ) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(x, y, z);
      b.castShadow = true;
      b.receiveShadow = true;
      this.group.add(b);
      return b;
    };

    const th = 0.12;
    // Dual-layer rails: slim outer gold + mid bevel (mobile must not look like side gutters)
    mk(W + th * 2.0, th * 1.0, 0, H / 2 + th * 0.65, -0.01, 0.28, goldMat);
    mk(W + th * 2.0, th * 1.0, 0, -H / 2 - th * 0.65, -0.01, 0.28, goldMat);
    mk(th * 1.0, H + th * 0.45, -W / 2 - th * 0.65, 0, -0.01, 0.28, goldMat);
    mk(th * 1.0, H + th * 0.45, W / 2 + th * 0.65, 0, -0.01, 0.28, goldMat);
    // Mid bevel (AO / thickness read)
    mk(W + th * 1.4, 0.07, 0, H / 2 + 0.03, 0.04, 0.16, midMetal);
    mk(W + th * 1.4, 0.07, 0, -H / 2 - 0.03, 0.04, 0.16, midMetal);
    mk(0.07, H + 0.04, -W / 2 - 0.01, 0, 0.04, 0.16, midMetal);
    mk(0.07, H + 0.04, W / 2 + 0.01, 0, 0.04, 0.16, midMetal);
    // Inner dark lip
    mk(W + th * 0.8, 0.04, 0, H / 2 - 0.015, 0.08, 0.09, darkMetal);
    mk(W + th * 0.8, 0.04, 0, -H / 2 + 0.015, 0.08, 0.09, darkMetal);

    for (let i = 1; i < REELS; i++) {
      const x = -W / 2 + FRAME_PAD / 2 + i * (CELL + GAP) - GAP / 2;
      mk(0.07, H * 0.98, x, 0, -0.03, 0.2, midMetal);
      mk(0.03, H * 0.98, x, 0, 0.06, 0.08, goldMat);
    }

    for (const [sx, sy] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ] as const) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), goldMat);
      orb.position.set(sx * (W / 2 + th * 0.7), sy * (H / 2 + th * 0.7), 0.1);
      orb.castShadow = true;
      this.group.add(orb);
    }

    // Tight glow — must not create perceived side gutters beyond the frame
    this.glowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(W + 0.35, H + 0.35),
      new THREE.MeshBasicMaterial({
        color: 0xffe29a,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.glowPlane.position.z = -0.22;
    this.group.add(this.glowPlane);

    // Glass specular strip (commercial reflection, does not cover symbols)
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 0.98, H * 0.14),
      new THREE.MeshBasicMaterial({
        color: 0xfff6d0,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glass.position.set(0, H * 0.28, 0.09);
    this.group.add(glass);

    // Top/bottom scroll masks (vignette inside frame)
    for (const [sy, y] of [
      [1, H / 2 - 0.08],
      [-1, -H / 2 + 0.08],
    ] as const) {
      const mask = new THREE.Mesh(
        new THREE.PlaneGeometry(W * 0.99, 0.55),
        new THREE.MeshBasicMaterial({
          color: 0x050302,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      mask.position.set(0, y, 0.05);
      mask.scale.y = sy;
      this.group.add(mask);
    }

    for (let i = 0; i < REELS; i++) {
      const reel = new Reel(i);
      reel.group.position.x = (i - (REELS - 1) / 2) * (CELL + GAP);
      reel.onStop = (idx) => this.onReelStop?.(idx);
      this.reels.push(reel);
      this.group.add(reel.group);
    }

    // M8 default: centered — buffalo lives in background layer
    this.group.position.set(0, 2.4, 0);
  }

  /**
   * Mobile-first full-bleed layout.
   * Scales the rig so left/right rails sit near the screen edges.
   * Phone landscape fills hardest; PC fills less aggressively.
   */
  /**
   * M8 P0 full-bleed.
   * @param sidePadPx left+right safe padding in CSS pixels (notch / home indicator)
   */
  setAspect(
    aspect: number,
    cameraZ = 11.2,
    fovYDeg = 46,
    sidePadPx = 8,
    viewportW = typeof window !== "undefined" ? window.innerWidth : 844,
    viewportH = typeof window !== "undefined" ? window.innerHeight : 390,
  ): void {
    // Convert safe pads to fill ratio — only necessary gutter, never large background wings
    const padRatio = Math.min(0.04, Math.max(0.006, (sidePadPx * 2) / Math.max(viewportW, 1)));
    const shortSide = Math.min(viewportW, viewportH);
    // Phone landscape (= short side ≤ 520): rails kiss edges. PC/tablet keep breathing room.
    const phoneLandscape = aspect >= 1.05 && shortSide <= 520;
    const phonePortrait = aspect < 1.05 && viewportW <= 500;
    const fill = phoneLandscape
      ? Math.min(0.998, 1 - Math.min(padRatio, 0.01)) // P0: rails kiss edges
      : phonePortrait
        ? 1 - Math.max(padRatio, 0.06)
        : aspect < 1.05
          ? 0.9
          : 0.88;

    const halfFov = THREE.MathUtils.degToRad(fovYDeg * 0.5);
    // Use real aspect — clamping to 0.5 over-scales portrait phones and clips rails
    const visibleHalfW = cameraZ * Math.tan(halfFov) * Math.max(aspect, 0.01);
    const targetHalfW = visibleHalfW * fill;
    const minScale = phonePortrait ? 0.72 : phoneLandscape ? 1.05 : 0.95;
    const scale = THREE.MathUtils.clamp(targetHalfW / this.frameHalfW, minScale, 3.35);
    this.scaleFactor = scale;
    this.group.scale.setScalar(scale);

    // Always center — game is the visual subject (not side panel)
    this.group.position.x = 0;
    // Phone landscape: lift slightly so bottom console does not bury the last row
    this.group.position.y = aspect < 1.05 ? 2.55 : phoneLandscape ? 2.42 : 2.32;

    // Approx CSS px per world unit at reel depth — for post-bounce pixel align
    const visibleHalfH = cameraZ * Math.tan(halfFov);
    const pxPerWorld = viewportH / Math.max(visibleHalfH * 2, 1e-6);
    for (const reel of this.reels) {
      reel.pixelsPerWorld = pxPerWorld * scale;
    }
  }

  /** World-space half-width after commercial scale (for camera fit). */
  scaledFrameHalfWidth(): number {
    return this.frameHalfW * this.scaleFactor;
  }

  /**
   * Project frame left/right rails to NDC for multi-size verification.
   * Returns fill ∈ [0,1] = fraction of screen width covered by the frame.
   */
  measureScreenFill(camera: THREE.Camera): {
    leftNdc: number;
    rightNdc: number;
    fill: number;
    scale: number;
  } {
    const half = this.scaledFrameHalfWidth();
    const y = this.group.position.y;
    const z = this.group.position.z;
    const left = new THREE.Vector3(-half, y, z).project(camera);
    const right = new THREE.Vector3(half, y, z).project(camera);
    const fill = Math.max(0, Math.min(1, (right.x - left.x) / 2));
    return { leftNdc: left.x, rightNdc: right.x, fill, scale: this.scaleFactor };
  }

  setGrid(grid: SymbolId[][]): void {
    for (let i = 0; i < REELS; i++) this.reels[i]!.setGrid(grid[i]!);
  }

  /**
   * Choreographed spin using centralized timing (reel-timing.ts).
   * Normal / Auto / Free Spin → NORMAL_SPIN_TOTAL_MS (6000); Turbo → ~2.5s.
   * Server may return early; visual timeline still plays fully here.
   * Grid must be the server result — never recomputed here.
   */
  spinAll(grid: SymbolId[][], turbo: boolean): Promise<void> {
    const profile = spinTimingProfile(turbo);
    const jobs = this.reels.map((reel, i) => {
      const stopMs = profile.stopMs[i] ?? profile.stopMs[profile.stopMs.length - 1]!;
      const durationSec = stopMs / 1000;
      const bounceSec = profile.bounceMs / 1000;
      const strip = spinStripDistance(i, profile.speedMult);
      return reel.spin(grid[i]!, durationSec, bounceSec, strip);
    });
    return Promise.all(jobs).then(() => undefined);
  }

  get anySpinning(): boolean {
    return this.reels.some((r) => r.isSpinning);
  }

  highlightCells(cells: Array<[number, number]>, grid?: SymbolId[][]): void {
    this.clearHighlights();
    for (const [reel, row] of cells) {
      if (this.reels[reel]) {
        this.reels[reel]!.setCellHighlight(row, true, this.winAmp);
      }
      const sym = grid?.[reel]?.[row];
      const kind = sym ? symbolAnimKind(sym) : "letter";
      const color =
        kind === "wild" ? 0x6eb6ff : kind === "scatter" ? 0xffb040 : 0xffd970;
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 1.12, CELL * 1.12),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glow.position.set((reel - (REELS - 1) / 2) * (CELL + GAP), cellY(row, 0), 0.025);
      glow.userData.pulse = true;
      glow.userData.kind = kind;
      this.highlights.push(glow);
      this.group.add(glow);

      // Expanding ring (does not cover neighbors permanently)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(CELL * 0.42, CELL * 0.52, 32),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      ring.position.copy(glow.position);
      ring.position.z = 0.03;
      ring.userData.ring = true;
      this.highlights.push(ring);
      this.group.add(ring);
    }
  }

  /**
   * Near-miss stop accent — presentation only.
   * Highlights existing server-grid cells; never rewrites symbols or stop timing.
   * @param intensity 0–1 (LOW quality should pass a reduced value)
   */
  pulseNearMissAccent(
    cells: Array<[number, number]>,
    grid: SymbolId[][] | undefined,
    intensity = 1,
  ): void {
    const amp = Math.min(1, Math.max(0.15, intensity));
    this.clearHighlights();
    this.setFrameGlow(0.35 * amp + 0.1);
    for (const [reel, row] of cells) {
      if (this.reels[reel]) {
        this.reels[reel]!.setCellHighlight(row, true, Math.min(1, amp));
      }
      const sym = grid?.[reel]?.[row];
      const kind = sym ? symbolAnimKind(sym) : "letter";
      // Cool amber edge cue — distinct from paid gold win highlights
      const color =
        kind === "scatter" ? 0xffc060 : kind === "wild" ? 0x7ec8ff : 0xe8c878;
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 1.08, CELL * 1.08),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glow.position.set((reel - (REELS - 1) / 2) * (CELL + GAP), cellY(row, 0), 0.025);
      glow.userData.pulse = true;
      glow.userData.nearMiss = true;
      glow.userData.nearMissAmp = amp;
      this.highlights.push(glow);
      this.group.add(glow);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(CELL * 0.4, CELL * 0.5, 28),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      ring.position.copy(glow.position);
      ring.position.z = 0.03;
      ring.userData.ring = true;
      ring.userData.nearMiss = true;
      ring.userData.nearMissAmp = amp;
      this.highlights.push(ring);
      this.group.add(ring);
    }
  }

  clearHighlights(): void {
    for (const reel of this.reels) {
      for (let r = 0; r < ROWS; r++) reel.setCellHighlight(r, false);
    }
    for (const h of this.highlights) {
      this.group.remove(h);
      const mat = h.material as THREE.Material;
      mat.dispose();
    }
    this.highlights = [];
  }

  update(dt: number, time: number): void {
    for (const reel of this.reels) reel.update(dt, time);
    for (const h of this.highlights) {
      const mat = h.material as THREE.MeshBasicMaterial;
      const nmAmp = typeof h.userData.nearMissAmp === "number" ? h.userData.nearMissAmp : 1;
      if (h.userData.ring) {
        const pulse = 0.55 + 0.45 * Math.sin(time * 7);
        mat.opacity = 0.22 * pulse * nmAmp;
        const s = 1 + 0.12 * Math.sin(time * 6) * nmAmp;
        h.scale.set(s, s, 1);
      } else {
        mat.opacity = (0.3 + 0.24 * Math.sin(time * 8)) * nmAmp;
      }
    }
    if (this.glowPlane) {
      const mat = this.glowPlane.material as THREE.MeshBasicMaterial;
      const pulse = 0.12 + 0.06 * Math.sin(time * 1.8);
      mat.opacity = pulse + this.frameGlowBoost * (0.28 + 0.18 * Math.sin(time * 5.5));
    }
  }
}
