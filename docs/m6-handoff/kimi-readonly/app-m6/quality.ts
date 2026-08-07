/**
 * M6-6 · 性能分级与自动降级
 * - 设备初判（移动端 / 弱核 / 低内存 → 低画质起步）
 * - FPS 监视器滚动降级 / 稳定升级
 * 纯表现层，无副作用。
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
}

const PROFILES: Record<QualityTier, Omit<QualityProfile, "tier">> = {
  high: {
    pixelRatio: 2,
    grassCount: 4000,
    treeCount: 24,
    furShells: 10,
    cloudCount: 10,
    enableBloom: true,
    enableGodRays: true,
    enableDof: true,
    enableGroundFog: true,
    coinBudget: 220,
    particleBudget: 400,
  },
  medium: {
    pixelRatio: 1.5,
    grassCount: 1800,
    treeCount: 14,
    furShells: 6,
    cloudCount: 6,
    enableBloom: true,
    enableGodRays: true,
    enableDof: false,
    enableGroundFog: true,
    coinBudget: 140,
    particleBudget: 220,
  },
  low: {
    pixelRatio: 1,
    grassCount: 600,
    treeCount: 7,
    furShells: 0,
    cloudCount: 3,
    enableBloom: false,
    enableGodRays: false,
    enableDof: false,
    enableGroundFog: false,
    coinBudget: 70,
    particleBudget: 100,
  },
};

export function profileFor(tier: QualityTier): QualityProfile {
  return { tier, ...PROFILES[tier] };
}

/** 设备能力初判：手机端 / 弱设备直接进入低或中档 */
export function detectInitialTier(): QualityTier {
  if (typeof navigator === "undefined") return "medium";
  const ua = navigator.userAgent ?? "";
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (mobile && (cores <= 4 || memory <= 3)) return "low";
  if (mobile) return "medium";
  if (cores <= 4 || memory <= 4) return "medium";
  return "high";
}

export const QUALITY_STORAGE_KEY = "ab-m6-quality";

export function readStoredQualityMode(): QualityMode {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(QUALITY_STORAGE_KEY);
  return v === "high" || v === "medium" || v === "low" || v === "auto" ? v : "auto";
}

export function storeQualityMode(mode: QualityMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUALITY_STORAGE_KEY, mode);
}

const ORDER: QualityTier[] = ["low", "medium", "high"];

/**
 * 滚动 FPS 监视器：
 * - 连续 2s 低于 lowMark → 降一档
 * - 连续 8s 高于 highMark → 升一档（不超过初始设备档位，防止震荡）
 */
export class FpsGovernor {
  private samples: number[] = [];
  private lastTime = 0;
  private ceiling: QualityTier;
  private cooldownUntil = 0;

  constructor(
    private tier: QualityTier,
    private readonly onChange: (tier: QualityTier) => void,
    private readonly lowMark = 42,
    private readonly highMark = 55,
  ) {
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

    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const idx = ORDER.indexOf(this.tier);
    if (avg < this.lowMark && idx > 0) {
      this.tier = ORDER[idx - 1];
      this.samples = [];
      this.cooldownUntil = now + 2000;
      this.onChange(this.tier);
    } else if (avg > this.highMark && idx < ORDER.indexOf(this.ceiling)) {
      this.tier = ORDER[idx + 1];
      this.samples = [];
      this.cooldownUntil = now + 8000;
      this.onChange(this.tier);
    }
  }
}
