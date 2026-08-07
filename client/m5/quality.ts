/**
 * M6 quality LOD — presentation only.
 * Adopted from Kimi M6 quality.ts; wired into formal client/m5 World/boot.
 * Never touches Session / Spin / Round / Balance / Math.
 */

export type QualityTier = "high" | "medium" | "low";
export type QualityMode = QualityTier | "auto";

export interface QualityProfile {
  tier: QualityTier;
  pixelRatio: number;
  grassCount: number;
  treeCount: number;
  furShells: number;
  cloudCount: number;
  enableBloom: boolean;
  enableGodRays: boolean;
  enableDof: boolean;
  enableGroundFog: boolean;
  coinBudget: number;
  particleBudget: number;
  shadowMapSize: number;
  /** Symbol life shader intensity: 2 full / 1 reduced / 0 blink+breath+win only */
  symbolAnimIntensity: 0 | 1 | 2;
}

/**
 * Phase3 clarity: never tank canvas DPR for "performance".
 * Mid/low only cut shadows / particles / post — Symbol sharpness stays high.
 */
const PROFILES: Record<QualityTier, Omit<QualityProfile, "tier">> = {
  high: {
    pixelRatio: 3,
    grassCount: 9000,
    treeCount: 3,
    furShells: 8,
    cloudCount: 9,
    enableBloom: true,
    enableGodRays: true,
    // DOF softens the reel board — off for commercial sharpness
    enableDof: false,
    enableGroundFog: true,
    coinBudget: 220,
    particleBudget: 400,
    shadowMapSize: 2048,
    symbolAnimIntensity: 2,
  },
  medium: {
    pixelRatio: 2,
    grassCount: 2500,
    treeCount: 2,
    furShells: 4,
    cloudCount: 6,
    enableBloom: true,
    enableGodRays: false,
    enableDof: false,
    enableGroundFog: true,
    coinBudget: 140,
    particleBudget: 220,
    shadowMapSize: 1024,
    symbolAnimIntensity: 1,
  },
  low: {
    // Keep ≥2 when device DPR allows — Symbol clarity is non-negotiable
    pixelRatio: 2,
    grassCount: 600,
    treeCount: 1,
    furShells: 0,
    cloudCount: 3,
    enableBloom: false,
    enableGodRays: false,
    enableDof: false,
    enableGroundFog: false,
    coinBudget: 70,
    particleBudget: 100,
    shadowMapSize: 512,
    // Keep blink / breath / win — cut exotic sheen via intensity gate in shader
    symbolAnimIntensity: 1,
  },
};

export function profileFor(tier: QualityTier): QualityProfile {
  return { tier, ...PROFILES[tier] };
}

/** Device capability probe: phones / weak devices start lower. */
export function detectInitialTier(): QualityTier {
  if (typeof navigator === "undefined") return "medium";
  const ua = navigator.userAgent ?? "";
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const smallScreen =
    typeof window !== "undefined" &&
    Math.min(window.innerWidth, window.innerHeight) < 620;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if ((mobile || smallScreen) && (cores <= 4 || memory <= 3)) return "low";
  if (mobile || smallScreen) return "medium";
  if (cores <= 4 || memory <= 4) return "medium";
  return "high";
}

export const QUALITY_STORAGE_KEY = "ab-m6-quality";

export function readStoredQualityMode(): QualityMode {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(QUALITY_STORAGE_KEY);
    return v === "high" || v === "medium" || v === "low" || v === "auto"
      ? v
      : "auto";
  } catch {
    return "auto";
  }
}

export function storeQualityMode(mode: QualityMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUALITY_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function resolveTier(mode: QualityMode): QualityTier {
  return mode === "auto" ? detectInitialTier() : mode;
}

const ORDER: QualityTier[] = ["low", "medium", "high"];

/**
 * Rolling FPS governor:
 * - ~2s below lowMark → drop one tier
 * - ~8s above highMark → raise one tier (capped by ceiling)
 */
export class FpsGovernor {
  private samples: number[] = [];
  private lastTime = 0;
  private ceiling: QualityTier;
  private cooldownUntil = 0;
  private tier: QualityTier;
  private readonly onChange: (tier: QualityTier) => void;
  private readonly lowMark: number;
  private readonly highMark: number;

  constructor(
    tier: QualityTier,
    onChange: (tier: QualityTier) => void,
    lowMark = 42,
    highMark = 55,
  ) {
    this.tier = tier;
    this.onChange = onChange;
    this.lowMark = lowMark;
    this.highMark = highMark;
    this.ceiling = tier;
  }

  get current(): QualityTier {
    return this.tier;
  }

  setManual(tier: QualityTier): void {
    this.tier = tier;
    this.ceiling = tier;
    this.samples = [];
  }

  setAutoCeiling(ceiling: QualityTier): void {
    this.ceiling = ceiling;
    if (ORDER.indexOf(this.tier) > ORDER.indexOf(ceiling)) {
      this.tier = ceiling;
      this.onChange(this.tier);
    }
  }

  tick(now: number): void {
    if (this.lastTime > 0) {
      const dt = now - this.lastTime;
      if (dt > 0 && dt < 500) {
        this.samples.push(1000 / dt);
        if (this.samples.length > 120) this.samples.shift();
      }
    }
    this.lastTime = now;
    if (this.samples.length < 60 || now < this.cooldownUntil) return;

    const avg =
      this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const idx = ORDER.indexOf(this.tier);
    if (avg < this.lowMark && idx > 0) {
      this.tier = ORDER[idx - 1]!;
      this.samples = [];
      this.cooldownUntil = now + 2000;
      this.onChange(this.tier);
    } else if (avg > this.highMark && idx < ORDER.indexOf(this.ceiling)) {
      this.tier = ORDER[idx + 1]!;
      this.samples = [];
      this.cooldownUntil = now + 8000;
      this.onChange(this.tier);
    }
  }
}

/** Debug hook gate — never open in production without explicit allow. */
export function allowDebugHooks(): boolean {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
    return process.env.AB_ALLOW_TEST_IDENTITY === "1";
  }
  // Browser / Vite: only when explicitly allowed via runtime flag or DEV + allow.
  try {
    const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
    const env = g.process?.env;
    if (env?.AB_ALLOW_TEST_IDENTITY === "1") return true;
    if (env?.NODE_ENV === "production") return false;
  } catch {
    /* ignore */
  }
  // Local DEV default: allow for QA; production builds must set NODE_ENV=production.
  return typeof import.meta !== "undefined" &&
    Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
}
