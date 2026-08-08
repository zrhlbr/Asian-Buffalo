/**
 * M8 Xi performance quality LOD — presentation only.
 * Extends Clarity V2: ULTRA tier, device probe, settings persist, step-down hysteresis.
 * Never touches Session / Spin / Round / Balance / Math / Wallet / Ledger.
 *
 * Symbol + HUD + Reel sharpness are never the first things sacrificed for FPS.
 */

export type QualityTier = "ultra" | "high" | "medium" | "low";
export type QualityMode = QualityTier | "auto";
export type AnimalAnimMode = "full" | "simple";
export type FpsTarget = 30 | 60 | "auto";

/** DPR caps by tier — mid-range fluency: avoid 3–4× on weak phones. */
export const PIXEL_RATIO_CAPS: Record<QualityTier, number> = {
  ultra: 3,
  high: 2.5,
  medium: 2,
  low: 1.5,
};

/**
 * Base render scale by tier. Soft-degrade may lower low-tier only.
 * Symbols/HUD stay independent; scale is last in DEGRADE_ORDER.
 */
export const RENDER_SCALE_BASE: Record<QualityTier, number> = {
  ultra: 1,
  high: 1,
  medium: 1,
  low: 1,
};

/** Last-resort scale when already on low and FPS still poor. */
export const RENDER_SCALE_FLOOR = 0.92;

/**
 * Auto degradation preference — cut atmosphere before resolution.
 * renderScale is ALWAYS last. Never list symbolPlate / HUD first.
 */
export const DEGRADE_ORDER = [
  "particles",
  "shadows",
  "godRays",
  "bloom",
  "bgComplexity",
  "renderScale",
] as const;

export type DegradeStep = (typeof DEGRADE_ORDER)[number];

export interface QualityProfile {
  tier: QualityTier;
  pixelRatio: number;
  /** Multiplier on drawing-buffer after DPR cap; 1 = full. Last-resort only. */
  renderScale: number;
  grassCount: number;
  treeCount: number;
  furShells: number;
  cloudCount: number;
  enableBloom: boolean;
  enableGodRays: boolean;
  enableDof: boolean;
  enableGroundFog: boolean;
  enableShadows: boolean;
  coinBudget: number;
  particleBudget: number;
  shadowMapSize: number;
  /** Symbol life shader intensity: 2 full / 1 reduced / 0 blink+breath+win only */
  symbolAnimIntensity: 0 | 1 | 2;
  /** Lobby/hub/CSS transition target ms */
  transitionMs: number;
  /** Hero / ambient particle density multiplier 0–1 */
  fxIntensity: number;
}

export interface QualitySettings {
  mode: QualityMode;
  /** Master FX gate — false forces bloom/godrays/particles off */
  fxEnabled: boolean;
  animalMode: AnimalAnimMode;
  fpsTarget: FpsTarget;
}

export interface DeviceCaps {
  deviceMemory: number;
  cores: number;
  dpr: number;
  width: number;
  height: number;
  gpuRenderer: string;
  maxTextureSize: number;
  webgl2: boolean;
  /** Short rAF sample; null when not measured */
  sampledFps: number | null;
  mobile: boolean;
  smallScreen: boolean;
}

const PROFILES: Record<QualityTier, Omit<QualityProfile, "tier">> = {
  ultra: {
    pixelRatio: PIXEL_RATIO_CAPS.ultra,
    renderScale: RENDER_SCALE_BASE.ultra,
    grassCount: 12000,
    treeCount: 4,
    furShells: 10,
    cloudCount: 12,
    enableBloom: true,
    enableGodRays: true,
    enableDof: false,
    enableGroundFog: true,
    enableShadows: true,
    coinBudget: 320,
    particleBudget: 560,
    shadowMapSize: 2048,
    symbolAnimIntensity: 2,
    transitionMs: 380,
    fxIntensity: 1,
  },
  high: {
    pixelRatio: PIXEL_RATIO_CAPS.high,
    renderScale: RENDER_SCALE_BASE.high,
    grassCount: 9000,
    treeCount: 3,
    furShells: 8,
    cloudCount: 9,
    enableBloom: true,
    enableGodRays: true,
    enableDof: false,
    enableGroundFog: true,
    enableShadows: true,
    coinBudget: 220,
    particleBudget: 400,
    shadowMapSize: 2048,
    symbolAnimIntensity: 2,
    transitionMs: 320,
    fxIntensity: 0.85,
  },
  medium: {
    pixelRatio: PIXEL_RATIO_CAPS.medium,
    renderScale: RENDER_SCALE_BASE.medium,
    grassCount: 2500,
    treeCount: 2,
    furShells: 4,
    cloudCount: 6,
    enableBloom: true,
    enableGodRays: false,
    enableDof: false,
    enableGroundFog: true,
    enableShadows: true,
    coinBudget: 140,
    particleBudget: 220,
    shadowMapSize: 1024,
    symbolAnimIntensity: 1,
    transitionMs: 260,
    fxIntensity: 0.55,
  },
  low: {
    pixelRatio: PIXEL_RATIO_CAPS.low,
    renderScale: RENDER_SCALE_BASE.low,
    grassCount: 600,
    treeCount: 1,
    furShells: 0,
    cloudCount: 3,
    enableBloom: false,
    enableGodRays: false,
    enableDof: false,
    enableGroundFog: false,
    enableShadows: false,
    coinBudget: 70,
    particleBudget: 100,
    shadowMapSize: 512,
    symbolAnimIntensity: 1,
    transitionMs: 220,
    fxIntensity: 0.25,
  },
};

export function profileFor(tier: QualityTier): QualityProfile {
  return { tier, ...PROFILES[tier] };
}

/** Apply FX / animal settings on top of a tier profile (presentation only). */
export function applySettingsToProfile(
  profile: QualityProfile,
  settings: Pick<QualitySettings, "fxEnabled" | "animalMode">,
): QualityProfile {
  let next = { ...profile };
  if (!settings.fxEnabled) {
    next = {
      ...next,
      enableBloom: false,
      enableGodRays: false,
      enableGroundFog: false,
      coinBudget: Math.min(next.coinBudget, 40),
      particleBudget: Math.min(next.particleBudget, 40),
      fxIntensity: 0,
      grassCount: Math.min(next.grassCount, 400),
      cloudCount: Math.min(next.cloudCount, 2),
    };
  }
  if (settings.animalMode === "simple") {
    next = {
      ...next,
      furShells: 0,
    };
  }
  return next;
}

/** Cap device DPR by tier — used by World + tests. */
export function clarityPixelRatioFor(
  deviceDpr: number,
  tier: QualityTier,
): number {
  const dpr = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1;
  const cap = PIXEL_RATIO_CAPS[tier];
  return Math.min(Math.max(dpr, 1), cap);
}

/**
 * Effective renderer pixel ratio = capped DPR × renderScale.
 * renderScale must stay in [RENDER_SCALE_FLOOR, 1] for commercial clarity.
 */
export function effectivePixelRatio(
  deviceDpr: number,
  tier: QualityTier,
  renderScale = 1,
): number {
  const scale = Math.min(1, Math.max(RENDER_SCALE_FLOOR, renderScale));
  return clarityPixelRatioFor(deviceDpr, tier) * scale;
}

/** Apply last-resort render scale without touching Symbol plate policy. */
export function withSoftRenderScale(
  profile: QualityProfile,
  scale: number,
): QualityProfile {
  const clamped = Math.min(1, Math.max(RENDER_SCALE_FLOOR, scale));
  // Only low tier may soft-scale; higher tiers keep full buffer
  if (profile.tier !== "low") return { ...profile, renderScale: 1 };
  return { ...profile, renderScale: clamped };
}

const WEAK_GPU =
  /swiftshader|llvmpipe|software|mali-4|mali-t6|mali-t7|adreno \(tm\) [23]|powervr sgx|intel hd graphics [234]/i;

export function probeWebGlCaps(): Pick<
  DeviceCaps,
  "gpuRenderer" | "maxTextureSize" | "webgl2"
> {
  if (typeof document === "undefined") {
    return { gpuRenderer: "", maxTextureSize: 4096, webgl2: true };
  }
  try {
    const canvas = document.createElement("canvas");
    const gl2 = canvas.getContext("webgl2");
    const gl =
      gl2 ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!gl || !(gl instanceof WebGLRenderingContext || (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext))) {
      return { gpuRenderer: "", maxTextureSize: 2048, webgl2: false };
    }
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const gpuRenderer = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "")
      : String(gl.getParameter(gl.RENDERER) ?? "");
    const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 2048;
    const webgl2 = Boolean(gl2);
    // Drop context ASAP
    const lose = (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return { gpuRenderer, maxTextureSize, webgl2 };
  } catch {
    return { gpuRenderer: "", maxTextureSize: 2048, webgl2: false };
  }
}

export function collectDeviceCaps(
  overrides: Partial<DeviceCaps> = {},
): DeviceCaps {
  const nav =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { deviceMemory?: number })
      : null;
  const ua = nav?.userAgent ?? "";
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const width =
    typeof window !== "undefined" ? window.innerWidth || 1280 : 1280;
  const height =
    typeof window !== "undefined" ? window.innerHeight || 720 : 720;
  const smallScreen = Math.min(width, height) < 620;
  const web = probeWebGlCaps();
  return {
    deviceMemory: nav?.deviceMemory ?? 4,
    cores: nav?.hardwareConcurrency ?? 4,
    dpr:
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    width,
    height,
    gpuRenderer: web.gpuRenderer,
    maxTextureSize: web.maxTextureSize,
    webgl2: web.webgl2,
    sampledFps: null,
    mobile,
    smallScreen,
    ...overrides,
  };
}

/** Score 0–100 from caps — pure function for unit tests. */
export function scoreDevice(caps: DeviceCaps): number {
  let score = 40;
  score += Math.min(24, caps.deviceMemory * 3);
  score += Math.min(16, caps.cores * 2);
  if (caps.webgl2) score += 6;
  if (caps.maxTextureSize >= 8192) score += 6;
  else if (caps.maxTextureSize >= 4096) score += 3;
  if (caps.dpr >= 3) score -= 4; // high DPR tax on fill-rate
  if (caps.mobile || caps.smallScreen) score -= 10;
  if (WEAK_GPU.test(caps.gpuRenderer)) score -= 28;
  if (caps.sampledFps != null) {
    if (caps.sampledFps >= 55) score += 12;
    else if (caps.sampledFps >= 45) score += 6;
    else if (caps.sampledFps >= 35) score += 0;
    else if (caps.sampledFps >= 28) score -= 10;
    else score -= 22;
  }
  const px = caps.width * caps.height * Math.min(caps.dpr, 3);
  if (px > 3_500_000) score -= 6;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Map score → AUTO tier. */
export function tierFromScore(score: number, caps?: DeviceCaps): QualityTier {
  // Hard floors for weak phones — never auto-ULTRA
  if (caps) {
    if (
      (caps.mobile || caps.smallScreen) &&
      (caps.deviceMemory <= 3 || caps.cores <= 4 || WEAK_GPU.test(caps.gpuRenderer))
    ) {
      return score >= 48 ? "medium" : "low";
    }
    if (caps.mobile || caps.smallScreen) {
      if (score >= 72) return "high";
      if (score >= 48) return "medium";
      return "low";
    }
  }
  if (score >= 82) return "ultra";
  if (score >= 64) return "high";
  if (score >= 42) return "medium";
  return "low";
}

/** Device capability probe: phones / weak devices start lower. */
export function detectInitialTier(caps?: DeviceCaps): QualityTier {
  const c = caps ?? collectDeviceCaps();
  return tierFromScore(scoreDevice(c), c);
}

/**
 * Short FPS sample via rAF (browser only). Resolves null in non-DOM / test.
 * Used to refine AUTO mapping — never blocks boot more than `ms`.
 */
export function sampleFps(ms = 400): Promise<number | null> {
  if (typeof window === "undefined" || typeof requestAnimationFrame !== "function") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let frames = 0;
    const start = performance.now();
    let last = start;
    const step = (now: number) => {
      frames++;
      last = now;
      if (now - start >= ms) {
        const elapsed = Math.max(1, last - start);
        resolve((frames * 1000) / elapsed);
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    window.setTimeout(() => resolve(null), ms + 200);
  });
}

export async function detectInitialTierAsync(): Promise<QualityTier> {
  const base = collectDeviceCaps();
  const fps = await sampleFps(380);
  return detectInitialTier({ ...base, sampledFps: fps });
}

export const QUALITY_STORAGE_KEY = "ab-m6-quality";
export const QUALITY_SETTINGS_KEY = "ab-m8-quality-settings";

const MODES: QualityMode[] = ["auto", "ultra", "high", "medium", "low"];

export function isQualityMode(v: unknown): v is QualityMode {
  return typeof v === "string" && (MODES as string[]).includes(v);
}

export function isQualityTier(v: unknown): v is QualityTier {
  return v === "ultra" || v === "high" || v === "medium" || v === "low";
}

export function defaultQualitySettings(): QualitySettings {
  return {
    mode: "auto",
    fxEnabled: true,
    animalMode: "full",
    fpsTarget: "auto",
  };
}

export function readStoredQualityMode(): QualityMode {
  return readStoredQualitySettings().mode;
}

export function storeQualityMode(mode: QualityMode): void {
  const s = readStoredQualitySettings();
  storeQualitySettings({ ...s, mode });
}

export function readStoredQualitySettings(): QualitySettings {
  const defaults = defaultQualitySettings();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(QUALITY_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<QualitySettings>;
      return normalizeSettings({ ...defaults, ...parsed });
    }
    // Migrate legacy single-key mode
    const legacy = window.localStorage.getItem(QUALITY_STORAGE_KEY);
    if (isQualityMode(legacy)) {
      return { ...defaults, mode: legacy };
    }
  } catch {
    /* ignore */
  }
  return defaults;
}

export function storeQualitySettings(settings: QualitySettings): void {
  if (typeof window === "undefined") return;
  const next = normalizeSettings(settings);
  try {
    window.localStorage.setItem(QUALITY_SETTINGS_KEY, JSON.stringify(next));
    // Keep legacy key in sync for older readers
    window.localStorage.setItem(QUALITY_STORAGE_KEY, next.mode);
  } catch {
    /* ignore */
  }
}

export function normalizeSettings(s: Partial<QualitySettings>): QualitySettings {
  const d = defaultQualitySettings();
  const mode = isQualityMode(s.mode) ? s.mode : d.mode;
  const animalMode =
    s.animalMode === "simple" || s.animalMode === "full" ? s.animalMode : d.animalMode;
  const fpsTarget =
    s.fpsTarget === 30 || s.fpsTarget === 60 || s.fpsTarget === "auto"
      ? s.fpsTarget
      : d.fpsTarget;
  return {
    mode,
    fxEnabled: s.fxEnabled !== false,
    animalMode,
    fpsTarget,
  };
}

export function resolveTier(
  mode: QualityMode,
  caps?: DeviceCaps,
): QualityTier {
  return mode === "auto" ? detectInitialTier(caps) : mode;
}

const ORDER: QualityTier[] = ["low", "medium", "high", "ultra"];

export function tierIndex(tier: QualityTier): number {
  return ORDER.indexOf(tier);
}

export function stepDownTier(tier: QualityTier): QualityTier {
  const idx = tierIndex(tier);
  return idx > 0 ? ORDER[idx - 1]! : tier;
}

/**
 * Rolling FPS governor (AUTO mode):
 * - sustained < lowMark for ~sustainMs → drop one tier (atmosphere first via profile)
 * - already on low + still poor → soft renderScale (DEGRADE_ORDER last step)
 * - hysteresis: NEVER auto step up (prevents bounce on mid-range phones)
 */
export class FpsGovernor {
  private samples: number[] = [];
  private lastTime = 0;
  private ceiling: QualityTier;
  private cooldownUntil = 0;
  private tier: QualityTier;
  private softScale = 1;
  private lowStreakMs = 0;
  private readonly onChange: (tier: QualityTier, softScale: number) => void;
  private readonly lowMark: number;
  private readonly sustainMs: number;
  private readonly allowStepUp: boolean;
  private readonly highMark: number;

  constructor(
    tier: QualityTier,
    onChange: (tier: QualityTier, softScale?: number) => void,
    lowMark = 35,
    highMark = 55,
    opts?: { sustainMs?: number; allowStepUp?: boolean },
  ) {
    this.tier = tier;
    this.onChange = (t, s) => onChange(t, s);
    this.lowMark = lowMark;
    this.highMark = highMark;
    this.ceiling = tier;
    this.sustainMs = opts?.sustainMs ?? 3800;
    // Default hysteresis: no bounce-up (Xi fluency brief)
    this.allowStepUp = opts?.allowStepUp ?? false;
  }

  get current(): QualityTier {
    return this.tier;
  }

  get renderScale(): number {
    return this.softScale;
  }

  setManual(tier: QualityTier): void {
    this.tier = tier;
    this.ceiling = tier;
    this.softScale = 1;
    this.samples = [];
    this.lowStreakMs = 0;
  }

  setAutoCeiling(ceiling: QualityTier): void {
    this.ceiling = ceiling;
    if (tierIndex(this.tier) > tierIndex(ceiling)) {
      this.tier = ceiling;
      this.softScale = 1;
      this.onChange(this.tier, this.softScale);
    }
  }

  tick(now: number): void {
    let frameDt = 0;
    if (this.lastTime > 0) {
      frameDt = now - this.lastTime;
      if (frameDt > 0 && frameDt < 500) {
        this.samples.push(1000 / frameDt);
        if (this.samples.length > 180) this.samples.shift();
      }
    }
    this.lastTime = now;
    if (this.samples.length < 45 || now < this.cooldownUntil) return;

    const avg =
      this.samples.reduce((a, b) => a + b, 0) / this.samples.length;

    if (avg < this.lowMark) {
      this.lowStreakMs += frameDt > 0 && frameDt < 500 ? frameDt : 16;
      if (this.lowStreakMs < this.sustainMs) return;
      const idx = tierIndex(this.tier);
      if (idx > 0) {
        this.tier = ORDER[idx - 1]!;
        this.softScale = 1;
        this.samples = [];
        this.lowStreakMs = 0;
        this.cooldownUntil = now + 2500;
        this.onChange(this.tier, this.softScale);
      } else if (this.softScale > RENDER_SCALE_FLOOR + 0.001) {
        this.softScale = RENDER_SCALE_FLOOR;
        this.samples = [];
        this.lowStreakMs = 0;
        this.cooldownUntil = now + 2500;
        this.onChange(this.tier, this.softScale);
      }
    } else {
      this.lowStreakMs = 0;
      if (!this.allowStepUp) return;
      if (avg > this.highMark) {
        if (this.softScale < 1 - 0.001 && this.tier === "low") {
          this.softScale = 1;
          this.samples = [];
          this.cooldownUntil = now + 8000;
          this.onChange(this.tier, this.softScale);
        } else if (tierIndex(this.tier) < tierIndex(this.ceiling)) {
          this.tier = ORDER[tierIndex(this.tier) + 1]!;
          this.softScale = 1;
          this.samples = [];
          this.cooldownUntil = now + 8000;
          this.onChange(this.tier, this.softScale);
        }
      }
    }
  }
}

/** Frame pacing helper — skips render when above target (presentation only). */
export class FramePacer {
  private lastDraw = 0;
  private target: FpsTarget;

  constructor(target: FpsTarget) {
    this.target = target;
  }

  setTarget(t: FpsTarget): void {
    this.target = t;
  }

  /** Returns true when a frame should be drawn. */
  shouldDraw(now: number): boolean {
    if (this.target === "auto") return true;
    const minDt = 1000 / this.target;
    if (now - this.lastDraw < minDt - 0.5) return false;
    this.lastDraw = now;
    return true;
  }
}

/** Document attrs for CSS transitions / lobby bridge (presentation only). */
export function applyDocumentTierAttrs(
  tier: QualityTier,
  settings?: Pick<QualitySettings, "mode" | "fxEnabled">,
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-xi-tier", tier);
  if (settings?.mode) root.setAttribute("data-xi-quality", settings.mode);
  if (settings) root.setAttribute("data-xi-fx", settings.fxEnabled ? "on" : "off");
  root.style.setProperty("--xi-transition-ms", `${profileFor(tier).transitionMs}ms`);
}

/** Debug hook gate — never open in production without explicit allow. */
export function allowDebugHooks(): boolean {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
    return process.env.AB_ALLOW_TEST_IDENTITY === "1";
  }
  try {
    const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
    const env = g.process?.env;
    if (env?.AB_ALLOW_TEST_IDENTITY === "1") return true;
    if (env?.NODE_ENV === "production") return false;
  } catch {
    /* ignore */
  }
  return typeof import.meta !== "undefined" &&
    Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
}
