/**
 * M6-3 · 转轴编排（表现层时序，不触碰数学与开奖逻辑）
 * 流程：SPINNING(滚动模糊) → 逐轴 STAGGER 停止 → 回弹 → 高亮/连线
 */

export const REEL_COUNT = 5;
/** 每轴停止间隔（ms） */
export const REEL_STAGGER_MS = 170;
/** 滚动模糊持续时间（ms），之后开始逐轴停 */
export const SPIN_ROLL_MS = 780;
/** 单轴回弹动画时长（ms），与 CSS 中 reel-bounce 对齐 */
export const REEL_BOUNCE_MS = 420;
/** 全部轴停稳所需总时长 */
export const TOTAL_SPIN_MS = SPIN_ROLL_MS + REEL_STAGGER_MS * (REEL_COUNT - 1) + REEL_BOUNCE_MS;

export type ReelPhase = "idle" | "rolling" | "stopping" | "settled";

export interface ReelChoreography {
  phase: ReelPhase;
  /** 每轴是否已经停稳 */
  stoppedReels: boolean[];
}

export const IDLE_CHOREO: ReelChoreography = {
  phase: "idle",
  stoppedReels: [true, true, true, true, true],
};

export function choreographyAt(elapsedMs: number): ReelChoreography {
  if (elapsedMs < 0) return IDLE_CHOREO;
  const stoppedReels = Array.from({ length: REEL_COUNT }, (_, reel) => {
    const stopAt = SPIN_ROLL_MS + REEL_STAGGER_MS * reel;
    return elapsedMs >= stopAt;
  });
  const allStopped = stoppedReels.every(Boolean);
  const allBounced = elapsedMs >= TOTAL_SPIN_MS;
  return {
    phase: allBounced ? "settled" : elapsedMs < SPIN_ROLL_MS ? "rolling" : "stopping",
    stoppedReels: allStopped && !allBounced ? stoppedReels : stoppedReels,
  };
}

/** 回弹缓动：overshoot cubic（供 CSS fallback 以外的 JS 计算场景） */
export function bounceEase(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = Math.min(1, Math.max(0, t));
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
