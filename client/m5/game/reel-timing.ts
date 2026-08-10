/**
 * Reel spin timing — presentation only (centralized).
 * Does not touch Session / Spin API / Grid authority / Wallet / Ledger.
 *
 * Direction remains TOP → BOTTOM for normal / turbo / auto / free spin.
 */

/** Ordinary / Auto / Free Spin reel choreography total (includes bounce). */
export const NORMAL_SPIN_TOTAL_MS = 6_000;

/**
 * Per-reel hard stop times (ms from animation start), before bounce.
 * Stagger: 4.2 → 5.8s; bounce finishes ~6.0s (±150ms).
 */
export const NORMAL_REEL_STOP_MS = [4200, 4600, 5000, 5400, 5800] as const;

/** Overshoot + settle after each reel reaches its stop (last reel → total ≈ 6.0s). */
export const NORMAL_BOUNCE_MS = 200;

/** Turbo keeps a fast independent cadence (not forced to 6s). */
export const TURBO_SPIN_TOTAL_MS = 2500;
export const TURBO_REEL_STOP_MS = [1400, 1650, 1900, 2150, 2350] as const;
export const TURBO_BOUNCE_MS = 150;

/**
 * Visual scroll intensity vs legacy short spins.
 * Higher → more strip cells traversed → faster perceived motion.
 * Kept at 1.35; may tune 1.35–1.5 against headed phone if still slow.
 */
export const SPIN_SPEED_MULT = 1.35;

/** Base strip cells for reel 0 at speed mult 1 (before index stagger). */
export const SPIN_STRIP_BASE = 72;
/** Extra strip cells per reel index (keeps columns visually dense, same base speed). */
export const SPIN_STRIP_STEP = 4;

export type SpinTimingProfile = {
  totalMs: number;
  stopMs: readonly number[];
  bounceMs: number;
  speedMult: number;
};

export function spinTimingProfile(turbo: boolean): SpinTimingProfile {
  if (turbo) {
    return {
      totalMs: TURBO_SPIN_TOTAL_MS,
      stopMs: TURBO_REEL_STOP_MS,
      bounceMs: TURBO_BOUNCE_MS,
      speedMult: SPIN_SPEED_MULT,
    };
  }
  return {
    totalMs: NORMAL_SPIN_TOTAL_MS,
    stopMs: NORMAL_REEL_STOP_MS,
    bounceMs: NORMAL_BOUNCE_MS,
    speedMult: SPIN_SPEED_MULT,
  };
}

/** Strip travel distance (cells) for a reel — presentation blur only. */
export function spinStripDistance(reelIndex: number, speedMult: number): number {
  return Math.max(
    8,
    Math.round((SPIN_STRIP_BASE + reelIndex * SPIN_STRIP_STEP) * speedMult),
  );
}

/**
 * Progress 0→1 along the strip with: quick accel → long fast cruise → late ease-out stop.
 * Position is always non-decreasing (downward scroll only).
 *
 * Tuned for ~6s normal: ~0.4s accel on first stop (4.2s), cruise, then late decel.
 */
export function spinMotionProgress(tNorm: number): number {
  const t = Math.min(Math.max(tNorm, 0), 1);
  const accelEnd = 0.095; // ~0.4s of a 4.2s stop
  const decelStart = 0.78; // last ~22% of reel time decelerates
  if (t <= accelEnd) {
    const u = t / accelEnd;
    return 0.06 * u * u;
  }
  if (t < decelStart) {
    const u = (t - accelEnd) / (decelStart - accelEnd);
    return 0.06 + u * 0.79;
  }
  const u = (t - decelStart) / (1 - decelStart);
  const e = 1 - Math.pow(1 - u, 3);
  return 0.85 + e * 0.15;
}
