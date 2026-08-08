/**
 * Symbol life animation — presentation only (animal-life v2).
 *
 * Visibility contract (CRITICAL): reel tiles use MeshBasicMaterial only.
 * Custom ShaderMaterial under ACES + EffectComposer + OutputPass made tiles
 * invisible (three@0.166). Life is driven by mesh UV-independent transforms,
 * per-material color tint, and opacity — proven-visible with the M8 post stack.
 *
 * Never mutates grid, spin, wallet, ledger, or math.
 */
import * as THREE from "three";
import type { SymbolId } from "../adapter.ts";

export const ANIMAL_SYMBOLS = [
  "buffalo",
  "lion",
  "elephant",
  "zebra",
  "antelope",
] as const;

export type AnimalSymbolId = (typeof ANIMAL_SYMBOLS)[number];
export type SymbolAnimKind = "animal" | "wild" | "scatter" | "letter";
export type LifeSpeciesId = AnimalSymbolId | "wild" | "scatter" | "letter";

/** 0 = letters off / animals minimal, 1 = medium, 2 = full animal life */
export type SymbolAnimIntensity = 0 | 1 | 2;

export type AccentKind =
  | "blink"
  | "ear"
  | "toss"
  | "nod"
  | "snort"
  | "mouth"
  | "nose"
  | "tail"
  | "lookHold"
  | "trunkRaise"
  | "mane"
  | "growl"
  | "headUp"
  | "sweep"
  | "energyPulse"
  | "chargeHint";

export type SpeciesProfile = {
  id: LifeSpeciesId;
  /** Continuous breath scale amplitude (recognition-safe). */
  breathAmp: number;
  breathHz: number;
  /** Slow look / gaze horizontal offset. */
  lookAmp: number;
  lookHz: number;
  /** Soft roll (ear / mane / body). */
  swayAmp: number;
  swayHz: number;
  /** Buffalo-style down-then-up nod allowed. */
  allowNod: boolean;
  /** Accent pool — species-specific; random, not synced. */
  accents: readonly AccentKind[];
  /** Preferred accent when tile is winning. */
  winAccent: AccentKind;
  /** Extra scale / tint on win. */
  winBoost: number;
  /** Idle tint channel bias (wild/scatter chromatic). */
  tintMode: "neutral" | "metal" | "sun";
};

export function isAnimalSymbol(id: SymbolId): id is AnimalSymbolId {
  return (ANIMAL_SYMBOLS as readonly string[]).includes(id);
}

export function symbolAnimKind(id: SymbolId): SymbolAnimKind {
  if (id === "wild") return "wild";
  if (id === "scatter") return "scatter";
  if (isAnimalSymbol(id)) return "animal";
  return "letter";
}

export function lifeSpeciesOf(id: SymbolId): LifeSpeciesId {
  if (id === "wild" || id === "scatter") return id;
  if (isAnimalSymbol(id)) return id;
  return "letter";
}

/** Stable phase seed so neighboring tiles don't animate in lockstep. */
export function symbolPhase(reel: number, cell: number): number {
  return (reel * 1.73 + cell * 2.41) % (Math.PI * 2);
}

/** Extra per-cell hash so accent schedules diverge even with similar phases. */
export function symbolSeed(reel: number, cell: number): number {
  const x = Math.imul(reel + 1, 374761393) ^ Math.imul(cell + 1, 668265263);
  return (x >>> 0) / 4294967296;
}

export const SPECIES_PROFILES: Record<LifeSpeciesId, SpeciesProfile> = {
  buffalo: {
    id: "buffalo",
    // Strongest continuous life — yaw / breath / sway readable at a glance
    breathAmp: 0.042,
    breathHz: 1.32,
    lookAmp: 0.038,
    lookHz: 0.36,
    swayAmp: 0.036,
    swayHz: 0.52,
    allowNod: true,
    accents: ["blink", "ear", "snort", "toss", "nod", "mouth", "lookHold", "chargeHint"],
    winAccent: "headUp",
    winBoost: 1.55,
    tintMode: "neutral",
  },
  lion: {
    id: "lion",
    // Shake / growl / mouth / nose / mane — deliberately no buffalo nod/toss set
    breathAmp: 0.032,
    breathHz: 1.5,
    lookAmp: 0.034,
    lookHz: 0.4,
    swayAmp: 0.046,
    swayHz: 0.55,
    allowNod: false,
    accents: ["blink", "mane", "lookHold", "mouth", "nose", "ear", "growl"],
    winAccent: "growl",
    winBoost: 1.4,
    tintMode: "neutral",
  },
  elephant: {
    id: "elephant",
    // Trunk / ears / body / blink
    breathAmp: 0.038,
    breathHz: 1.0,
    lookAmp: 0.026,
    lookHz: 0.3,
    swayAmp: 0.048,
    swayHz: 0.58,
    allowNod: false,
    accents: ["blink", "ear", "lookHold", "trunkRaise"],
    winAccent: "trunkRaise",
    winBoost: 1.45,
    tintMode: "neutral",
  },
  zebra: {
    id: "zebra",
    // Toss / ears / look — lighter body than buffalo
    breathAmp: 0.03,
    breathHz: 1.65,
    lookAmp: 0.034,
    lookHz: 0.48,
    swayAmp: 0.032,
    swayHz: 0.72,
    allowNod: false,
    accents: ["blink", "ear", "lookHold", "toss", "tail"],
    winAccent: "toss",
    winBoost: 1.32,
    tintMode: "neutral",
  },
  antelope: {
    id: "antelope",
    // Nod / look / alert ears
    breathAmp: 0.028,
    breathHz: 1.8,
    lookAmp: 0.036,
    lookHz: 0.58,
    swayAmp: 0.028,
    swayHz: 0.8,
    allowNod: true,
    accents: ["blink", "ear", "lookHold", "nod", "headUp"],
    winAccent: "headUp",
    winBoost: 1.35,
    tintMode: "neutral",
  },
  wild: {
    id: "wild",
    /* Visual motif hint: jingubang / energy — ID unchanged */
    breathAmp: 0.016,
    breathHz: 2.2,
    lookAmp: 0,
    lookHz: 0.2,
    swayAmp: 0.012,
    swayHz: 1.1,
    allowNod: false,
    accents: ["energyPulse", "sweep"],
    winAccent: "energyPulse",
    winBoost: 1.4,
    tintMode: "metal",
  },
  scatter: {
    id: "scatter",
    /* Visual motif hint: palace token / lotus / cloud / array — ID unchanged */
    breathAmp: 0.014,
    breathHz: 1.9,
    lookAmp: 0,
    lookHz: 0.2,
    swayAmp: 0.01,
    swayHz: 0.9,
    allowNod: false,
    accents: ["sweep", "energyPulse"],
    winAccent: "sweep",
    winBoost: 1.35,
    tintMode: "sun",
  },
  letter: {
    id: "letter",
    breathAmp: 0,
    breathHz: 1,
    lookAmp: 0,
    lookHz: 0.2,
    swayAmp: 0,
    swayHz: 0.5,
    allowNod: false,
    accents: [],
    winAccent: "blink",
    winBoost: 1.05,
    tintMode: "neutral",
  },
};

export function speciesProfile(id: SymbolId | LifeSpeciesId): SpeciesProfile {
  return SPECIES_PROFILES[lifeSpeciesOf(id as SymbolId)];
}

/**
 * LOD gate: low/medium reduce accent frequency & amp.
 * Buffalo NEVER fully disables — always at least reduced life.
 */
export function lifeIntensityForSymbol(
  id: SymbolId | LifeSpeciesId,
  lod: SymbolAnimIntensity,
): number {
  const sp = lifeSpeciesOf(id as SymbolId);
  if (sp === "letter") return 0;
  if (sp === "buffalo") return Math.max(1, lod);
  return lod;
}

/** Accent interval stretch by LOD (higher = rarer accents). */
export function accentIntervalScale(lod: number): number {
  if (lod >= 2) return 1;
  if (lod >= 1) return 1.55;
  return 2.2;
}

export type SymbolLifeUniforms = {
  uMap: { value: THREE.Texture | null };
  uTime: { value: number };
  uPhase: { value: number };
  uOpacity: { value: number };
  uWin: { value: number };
  uKind: { value: number };
  uIntensity: { value: number };
  uSpinning: { value: number };
  uTint: { value: THREE.Color };
  uSpecies: { value: number };
};

const KIND_CODE: Record<SymbolAnimKind, number> = {
  letter: 0,
  animal: 1,
  wild: 2,
  scatter: 3,
};

const SPECIES_CODE: Record<LifeSpeciesId, number> = {
  letter: 0,
  buffalo: 1,
  lion: 2,
  elephant: 3,
  zebra: 4,
  antelope: 5,
  wild: 6,
  scatter: 7,
};

/** Deterministic [0,1) from seed + salt. */
function hash01(seed: number, salt: number): number {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function smoothPulse(t: number): number {
  // 0→1→0 over [0,1]
  const x = clamp01(t);
  return Math.sin(x * Math.PI);
}

type AccentState = {
  kind: AccentKind | null;
  start: number;
  dur: number;
};

type LifeState = {
  kind: SymbolAnimKind;
  species: LifeSpeciesId;
  phase: number;
  seed: number;
  time: number;
  opacity: number;
  win: number;
  intensity: SymbolAnimIntensity;
  spinning: number;
  nextAccentAt: number;
  accent: AccentState;
  /** One-shot win intensifier latch. */
  winPulse: number;
};

function lifeState(mat: THREE.Material): LifeState {
  const ud = mat.userData as { symbolLife?: LifeState };
  if (!ud.symbolLife) {
    ud.symbolLife = {
      kind: "letter",
      species: "letter",
      phase: 0,
      seed: Math.random(),
      time: 0,
      opacity: 1,
      win: 0,
      intensity: 2,
      spinning: 0,
      nextAccentAt: 0.5 + Math.random() * 2,
      accent: { kind: null, start: 0, dur: 0 },
      winPulse: 0,
    };
  }
  return ud.symbolLife;
}

function pickAccent(
  profile: SpeciesProfile,
  seed: number,
  salt: number,
  winning: boolean,
): AccentKind | null {
  if (winning) return profile.winAccent;
  const list = profile.accents.filter((a) => profile.allowNod || a !== "nod");
  if (!list.length) return null;
  const i = Math.floor(hash01(seed, salt) * list.length) % list.length;
  return list[i]!;
}

function scheduleNextAccent(
  life: LifeState,
  profile: SpeciesProfile,
  time: number,
  lifeAmt: number,
  winning: boolean,
): void {
  const scale = accentIntervalScale(lifeAmt);
  // Slightly denser accents so life reads without becoming twitchy
  const min = winning ? 1.4 : 2.2;
  const max = winning ? 3.6 : 7.5;
  const span = (max - min) * scale;
  const u = hash01(life.seed, life.nextAccentAt + profile.id.length + time * 0.01);
  life.nextAccentAt = time + min * scale + u * span;
}

function accentContribution(
  accent: AccentState,
  time: number,
  profile: SpeciesProfile,
): {
  ox: number;
  oy: number;
  rz: number;
  sx: number;
  sy: number;
  dim: number;
  warm: number;
} {
  const out = { ox: 0, oy: 0, rz: 0, sx: 0, sy: 0, dim: 0, warm: 0 };
  if (!accent.kind || accent.dur <= 0) return out;
  const u = (time - accent.start) / accent.dur;
  if (u < 0 || u > 1) return out;
  const p = smoothPulse(u);

  // Species amp bias — buffalo reads strongest; lion shake ≠ buffalo toss
  const speciesMul =
    profile.id === "buffalo"
      ? 1.35
      : profile.id === "lion"
        ? 1.2
        : profile.id === "elephant"
          ? 1.18
          : profile.id === "zebra" || profile.id === "antelope"
            ? 1.12
            : 1;

  switch (accent.kind) {
    case "blink":
      out.dim = 0.14 * p * speciesMul;
      out.sy = -0.02 * p * speciesMul;
      break;
    case "ear":
      out.rz = 0.07 * Math.sin(u * Math.PI * 2) * p * speciesMul;
      break;
    case "toss":
      out.oy = 0.048 * p * speciesMul;
      out.rz = 0.05 * Math.sin(u * Math.PI) * (u < 0.5 ? 1 : -0.4) * speciesMul;
      break;
    case "nod":
      // Down then up — buffalo / antelope only (profile.allowNod)
      if (profile.allowNod) {
        const dip = u < 0.45 ? smoothPulse(u / 0.45) : smoothPulse((1 - u) / 0.55);
        out.oy = -0.04 * dip * speciesMul;
        out.sy = -0.018 * dip * speciesMul;
      }
      break;
    case "snort":
      out.sx = 0.03 * p * speciesMul;
      out.warm = 0.12 * p * speciesMul;
      out.oy = 0.012 * p * speciesMul;
      break;
    case "mouth":
      out.sy = 0.024 * p * speciesMul;
      out.warm = 0.06 * p * speciesMul;
      break;
    case "nose":
      out.sx = 0.018 * Math.sin(u * Math.PI * 3) * p * speciesMul;
      out.warm = 0.08 * p * speciesMul;
      break;
    case "tail":
      out.rz = 0.085 * Math.sin(u * Math.PI * 3) * p * speciesMul;
      break;
    case "lookHold":
      out.ox = 0.038 * Math.sin(accent.start * 3.1) * p * speciesMul;
      break;
    case "trunkRaise":
      out.oy = 0.07 * p * speciesMul;
      out.sy = 0.036 * p * speciesMul;
      out.ox = 0.02 * Math.sin(u * Math.PI) * p * speciesMul;
      break;
    case "mane":
      // Lion head-shake (not a buffalo nod)
      out.rz = 0.065 * Math.sin(u * Math.PI * 2.6) * p * speciesMul;
      out.sx = 0.022 * p * speciesMul;
      out.ox = 0.012 * Math.sin(u * Math.PI * 3) * p;
      break;
    case "growl":
      out.sy = 0.034 * p * speciesMul;
      out.sx = 0.018 * p * speciesMul;
      out.warm = 0.14 * p * speciesMul;
      out.dim = 0.05 * (1 - p);
      out.rz = 0.02 * Math.sin(u * Math.PI * 4) * p;
      break;
    case "headUp":
      out.oy = 0.055 * p * speciesMul;
      out.sy = 0.028 * p * speciesMul;
      out.warm = 0.09 * p * speciesMul;
      break;
    case "sweep":
      out.warm = 0.16 * p;
      out.sx = 0.014 * p;
      break;
    case "energyPulse":
      out.sx = 0.028 * p;
      out.sy = 0.028 * p;
      out.warm = 0.14 * p;
      break;
    case "chargeHint":
      out.oy = 0.036 * p * speciesMul;
      out.sx = 0.04 * p * speciesMul;
      out.sy = 0.04 * p * speciesMul;
      out.warm = 0.14 * p * speciesMul;
      break;
    default:
      break;
  }
  return out;
}

/**
 * Tile material used by reels.
 * MeshBasicMaterial is the proven M8-visible path — do not swap to ShaderMaterial
 * without verifying idle visibility under the real post pipeline.
 */
export type SymbolTileMaterial = THREE.MeshBasicMaterial;

export function createSymbolMaterial(
  map: THREE.Texture,
  kind: SymbolAnimKind,
  phase: number,
  species: LifeSpeciesId = kind === "wild"
    ? "wild"
    : kind === "scatter"
      ? "scatter"
      : kind === "animal"
        ? "buffalo"
        : "letter",
  seed = phase / (Math.PI * 2),
): SymbolTileMaterial {
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    toneMapped: true,
    fog: true,
  });
  const life = lifeState(mat);
  life.kind = kind;
  life.species = species;
  life.phase = phase;
  life.seed = seed;
  life.nextAccentAt = 0.4 + hash01(seed, 1) * 3.5;
  (mat as unknown as { uniforms: SymbolLifeUniforms }).uniforms = {
    uMap: { value: map },
    uTime: { value: 0 },
    uPhase: { value: phase },
    uOpacity: { value: 1 },
    uWin: { value: 0 },
    uKind: { value: KIND_CODE[kind] },
    uIntensity: { value: 2 },
    uSpinning: { value: 0 },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uSpecies: { value: SPECIES_CODE[species] },
  };
  return mat;
}

export function setSymbolMap(
  mat: SymbolTileMaterial,
  map: THREE.Texture,
  kind: SymbolAnimKind,
  species?: LifeSpeciesId,
): void {
  mat.map = map;
  mat.needsUpdate = true;
  const life = lifeState(mat);
  const prev = life.species;
  life.kind = kind;
  if (species) life.species = species;
  else if (kind === "wild") life.species = "wild";
  else if (kind === "scatter") life.species = "scatter";
  else if (kind === "letter") life.species = "letter";
  // Keep animal species sticky until caller passes explicit id (reels always does).
  if (kind === "animal" && species) life.species = species;

  if (life.species !== prev) {
    // Reschedule so species swap doesn't sync accents across the board.
    life.nextAccentAt =
      life.time + 0.6 + hash01(life.seed, SPECIES_CODE[life.species]) * 4;
    life.accent = { kind: null, start: 0, dur: 0 };
  }

  const u = (mat as unknown as { uniforms?: SymbolLifeUniforms }).uniforms;
  if (u) {
    u.uMap.value = map;
    u.uKind.value = KIND_CODE[kind];
    u.uSpecies.value = SPECIES_CODE[life.species];
  }
}

/** Force a species win intensifier on the next frames (presentation only). */
export function triggerSymbolWinAccent(mat: SymbolTileMaterial, tierAmp = 1): void {
  const life = lifeState(mat);
  const profile = SPECIES_PROFILES[life.species];
  life.winPulse = Math.min(2, Math.max(0.5, tierAmp));
  life.accent = {
    kind: life.species === "buffalo" && tierAmp >= 1.6 ? "chargeHint" : profile.winAccent,
    start: life.time,
    dur: 0.55 + 0.2 * life.winPulse,
  };
  life.nextAccentAt = life.time + 1.2;
}

export function updateSymbolLife(
  mat: SymbolTileMaterial,
  opts: {
    time: number;
    opacity: number;
    /** boolean or 0..2 tier amplify (presentation). */
    win: boolean | number;
    intensity: SymbolAnimIntensity;
    /** true/false or 0..1 fade — soft restore after stop (~0.15s). */
    spinning: boolean | number;
    tint?: number;
    /** Formal symbol id for species profile. */
    symbolId?: SymbolId;
    /** Cell mesh — transforms applied here (visible path). */
    mesh?: THREE.Mesh;
    baseScaleX?: number;
    baseScaleY?: number;
    basePosY?: number;
  },
): void {
  const life = lifeState(mat);
  life.time = opts.time;
  life.opacity = opts.opacity;
  life.win =
    typeof opts.win === "number" ? Math.min(2, Math.max(0, opts.win)) : opts.win ? 1 : 0;
  life.intensity = opts.intensity;
  life.spinning =
    typeof opts.spinning === "number"
      ? Math.min(1, Math.max(0, opts.spinning))
      : opts.spinning
        ? 1
        : 0;

  if (opts.symbolId) {
    const sp = lifeSpeciesOf(opts.symbolId);
    life.species = sp;
    life.kind = symbolAnimKind(opts.symbolId);
  }

  const profile = SPECIES_PROFILES[life.species];
  const lod = lifeIntensityForSymbol(life.species, life.intensity);
  const spinAmt = life.spinning;
  const lifeAmt = lod * (1 - spinAmt * 0.9);
  const winning = life.win > 0.01;

  // Accent scheduler — desynced per seed; 3–10s idle (scaled by LOD).
  if (lifeAmt > 0.01 && profile.accents.length + (winning ? 1 : 0) > 0) {
    if (life.accent.kind && opts.time >= life.accent.start + life.accent.dur) {
      life.accent = { kind: null, start: 0, dur: 0 };
    }
    if (!life.accent.kind && opts.time >= life.nextAccentAt) {
      const kind = pickAccent(profile, life.seed, opts.time, winning);
      if (kind) {
        const dur =
          kind === "blink"
            ? 0.12 + hash01(life.seed, opts.time) * 0.06
            : kind === "lookHold"
              ? 0.7 + hash01(life.seed, opts.time + 1) * 0.5
              : 0.35 + hash01(life.seed, opts.time + 2) * 0.45;
        life.accent = { kind, start: opts.time, dur };
      }
      scheduleNextAccent(life, profile, opts.time, lifeAmt, winning);
    }
  }

  // Reliable visibility path (MeshBasicMaterial.opacity).
  mat.transparent = true;
  mat.opacity = Math.min(1, Math.max(0, opts.opacity));

  const baseTint = opts.tint ?? 1;
  const ampScale = (lod >= 2 ? 1 : lod >= 1 ? 0.72 : 0.45) * (winning ? 1 + life.win * 0.35 : 1);
  const breath =
    lifeAmt > 0.01
      ? Math.sin(opts.time * profile.breathHz + life.phase) * profile.breathAmp * ampScale
      : 0;
  const look =
    lifeAmt > 0.01 && profile.lookAmp > 0
      ? Math.sin(opts.time * profile.lookHz + life.phase * 1.3) *
        profile.lookAmp *
        ampScale *
        (1 + (winning ? 0.35 : 0))
      : 0;
  const sway =
    lifeAmt > 0.01
      ? Math.sin(opts.time * profile.swayHz + life.phase * 0.7) *
        profile.swayAmp *
        ampScale
      : 0;

  const acc = accentContribution(life.accent, opts.time, profile);
  if (life.winPulse > 0 && !life.accent.kind) {
    life.winPulse = Math.max(0, life.winPulse - 0.02);
  }

  // Color / tint — species chromatic without fragment shaders.
  let r = baseTint;
  let g = baseTint;
  let b = baseTint;
  if (lifeAmt > 0.01) {
    const breathTint = breath * 1.2;
    r += breathTint;
    g += breathTint;
    b += breathTint;
    // Buffalo nostril / hide warmth on breath peaks (continuous, subtle)
    if (life.species === "buffalo") {
      const snort = Math.max(0, Math.sin(opts.time * profile.breathHz + life.phase));
      r += 0.03 * snort * lifeAmt;
      g += 0.015 * snort * lifeAmt;
    }
    if (profile.tintMode === "metal") {
      const flow = 0.5 + 0.5 * Math.sin(opts.time * 3.2 + life.phase);
      const gold = 0.5 + 0.5 * Math.sin(opts.time * 2.1 + life.phase * 1.7);
      r += 0.08 * gold * lifeAmt;
      g += 0.05 * gold * lifeAmt;
      b += 0.1 * flow * lifeAmt;
      r += 0.04 * flow * lifeAmt;
    } else if (profile.tintMode === "sun") {
      const sun = 0.5 + 0.5 * Math.sin(opts.time * 2.4 + life.phase);
      const sweep = 0.5 + 0.5 * Math.sin(opts.time * 1.1 + life.phase * 2.0);
      r += 0.1 * sun * lifeAmt;
      g += 0.07 * sun * lifeAmt;
      b += 0.02 * sun * lifeAmt;
      r += 0.05 * sweep * lifeAmt;
      g += 0.03 * sweep * lifeAmt;
    }
  }
  if (winning) {
    const pulse = 0.55 + 0.45 * Math.sin(opts.time * (8 + life.win * 2) + life.phase);
    r += 0.14 * life.win * pulse;
    g += 0.11 * life.win * pulse;
    b += 0.05 * life.win * pulse;
  }
  r += acc.warm - acc.dim;
  g += acc.warm * 0.7 - acc.dim;
  b += acc.warm * 0.35 - acc.dim;
  mat.color.setRGB(
    Math.min(1.85, Math.max(0.55, r)),
    Math.min(1.85, Math.max(0.55, g)),
    Math.min(1.85, Math.max(0.55, b)),
  );

  // Mesh transforms — primary life motion (visible under MeshBasic + post).
  const mesh = opts.mesh;
  if (mesh) {
    const bsx = opts.baseScaleX ?? 1;
    const bsy = opts.baseScaleY ?? 1;
    const by = opts.basePosY ?? mesh.position.y;
    const winPop = winning ? 1 + 0.02 * life.win * profile.winBoost : 1;
    mesh.scale.set(
      bsx * (1 + breath + acc.sx) * winPop,
      bsy * (1 + breath * 0.85 + acc.sy) * winPop,
      1,
    );
    mesh.position.x = look + acc.ox;
    mesh.position.y = by + acc.oy + (winning ? 0.008 * life.win : 0);
    mesh.rotation.z = sway + acc.rz;
  }

  const u = (mat as unknown as { uniforms?: SymbolLifeUniforms }).uniforms;
  if (u) {
    u.uTime.value = opts.time;
    u.uOpacity.value = opts.opacity;
    u.uWin.value = life.win;
    u.uIntensity.value = lod;
    u.uSpinning.value = life.spinning;
    u.uTint.value.setRGB(mat.color.r, mat.color.g, mat.color.b);
    u.uKind.value = KIND_CODE[life.kind];
    u.uSpecies.value = SPECIES_CODE[life.species];
  }
}

/** Diagnostic: material path must remain MeshBasic for reel tiles. */
export function isVisibleTileMaterial(mat: THREE.Material): boolean {
  return mat instanceof THREE.MeshBasicMaterial && !(mat instanceof THREE.ShaderMaterial);
}

/** Contract helper — species behaviors landed in the MeshBasic life path. */
export function symbolLifeShaderFeatures(): string[] {
  return symbolLifeFeatures();
}

export function symbolLifeFeatures(): string[] {
  return [
    "breath",
    "blink",
    "gaze",
    "ear",
    "species-profiles",
    "desync-accents",
    "buffalo-nod",
    "lion-no-nod",
    "elephant-trunk",
    "zebra-tail",
    "antelope-alert",
    "wild-metal",
    "scatter-sun",
    "win-intensify",
    "lod-buffalo-keep",
    "meshbasic-visible",
  ];
}

/** Test helper: profiles must differ across animals. */
export function speciesBehaviorFingerprint(id: LifeSpeciesId): string {
  const p = SPECIES_PROFILES[id];
  return [
    p.id,
    p.breathHz.toFixed(2),
    p.lookHz.toFixed(2),
    p.swayHz.toFixed(2),
    p.allowNod ? "nod" : "nonod",
    p.accents.join("+"),
    p.winAccent,
    p.tintMode,
  ].join("|");
}
