/**
 * M6 · 3D 场景共享类型
 */
import type { QualityProfile } from "../quality";

export type WinTier = "big" | "mega" | "ultra" | "jackpot";

export interface SceneHandle {
  /** 奔跑动作（自动归位，约 2.4s） */
  playRun(): void;
  /** 咆哮（镜头微震 + 吼声由音效层负责） */
  playRoar(): void;
  /** 胜利动作（跃起 + 抬头） */
  playVictory(): void;
  /** 大奖镜头演出：震屏 + 推镜 + 光感增强 */
  celebrate(tier: WinTier): void;
  /** 免费旋转模式：天空转黄昏金、雾色转暖 */
  setFreeSpin(on: boolean): void;
  /** 应用画质档位（LOD / 草密度 / 后处理开关） */
  applyQuality(profile: QualityProfile): void;
  /** 每帧回报（供 FPS 监视器采样） */
  readonly onFrame: ((now: number) => void) | null;
  setOnFrame(cb: ((now: number) => void) | null): void;
  dispose(): void;
}

export interface SceneOptions {
  initialQuality: QualityProfile;
  onReady?: () => void;
}
