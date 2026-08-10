"use client";

/**
 * M6-2/M6-6 · 3D 场景宿主
 * - 懒加载：首次渲染后动态 import three 场景 chunk（不占首屏）
 * - FPS 监视器：auto 模式下滚动降级 / 升级
 * - 手机端初判低档（quality.ts）
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  FpsGovernor,
  detectInitialTier,
  profileFor,
  type QualityMode,
  type QualityProfile,
  type QualityTier,
} from "../quality";
import type { SceneHandle, WinTier } from "../scene/types";
import type { Locale } from "../i18n";
import { translate } from "../i18n";

export interface SceneHostHandle {
  playRun(): void;
  playRoar(): void;
  playVictory(): void;
  celebrate(tier: WinTier): void;
  setFreeSpin(on: boolean): void;
}

const SceneHost = forwardRef<
  SceneHostHandle,
  {
    locale: Locale;
    qualityMode: QualityMode;
    onProfileChange?: (profile: QualityProfile) => void;
    onReadyTier?: (tier: QualityTier) => void;
  }
>(function SceneHost({ locale, qualityMode, onProfileChange, onReadyTier }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const governorRef = useRef<FpsGovernor | null>(null);
  const pendingRef = useRef<Array<(scene: SceneHandle) => void>>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [profile, setProfile] = useState<QualityProfile>(() =>
    profileFor(qualityMode === "auto" ? detectInitialTier() : qualityMode),
  );

  // 画质模式切换（手动档）
  useEffect(() => {
    if (qualityMode === "auto") return;
    const next = profileFor(qualityMode);
    setProfile(next);
    governorRef.current?.setManual(next.tier);
    sceneRef.current?.applyQuality(next);
    onProfileChange?.(next);
  }, [qualityMode, onProfileChange]);

  useEffect(() => {
    let cancelled = false;
    const initial = profileFor(qualityMode === "auto" ? detectInitialTier() : qualityMode);
    setProfile(initial);
    onReadyTier?.(initial.tier);

    const governor = new FpsGovernor(initial.tier, (tier) => {
      if (qualityMode !== "auto") return;
      const next = profileFor(tier);
      setProfile(next);
      sceneRef.current?.applyQuality(next);
      onProfileChange?.(next);
    });
    governorRef.current = governor;

    // 懒加载场景 chunk
    import("../scene/index")
      .then((mod) => {
        if (cancelled || !canvasRef.current) return;
        return mod.createSavannaScene(canvasRef.current, {
          initialQuality: initial,
          onReady: () => {
            if (cancelled) return;
            setLoading(false);
          },
        });
      })
      .then((scene) => {
        if (!scene) return;
        if (cancelled) {
          scene.dispose();
          return;
        }
        sceneRef.current = scene;
        scene.setOnFrame((now) => governor.tick(now));
        // 播放挂载前排队的事件
        pendingRef.current.forEach((fn) => fn(scene));
        pendingRef.current = [];
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => {
    const dispatch = (fn: (scene: SceneHandle) => void) => {
      if (sceneRef.current) fn(sceneRef.current);
      else pendingRef.current.push(fn);
    };
    return {
      playRun: () => dispatch((s) => s.playRun()),
      playRoar: () => dispatch((s) => s.playRoar()),
      playVictory: () => dispatch((s) => s.playVictory()),
      celebrate: (tier) => dispatch((s) => s.celebrate(tier)),
      setFreeSpin: (on) => dispatch((s) => s.setFreeSpin(on)),
    };
  }, []);

  return (
    <div className="scene-host" data-quality={profile.tier} aria-hidden="true">
      <canvas ref={canvasRef} className="scene-canvas" />
      {loading && !failed ? (
        <div className="scene-loading">{translate(locale, "sceneLoading")}</div>
      ) : null}
    </div>
  );
});

export default SceneHost;
