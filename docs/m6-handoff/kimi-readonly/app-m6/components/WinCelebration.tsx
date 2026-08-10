"use client";

/**
 * M6-4 · 大奖演出
 * Big / Mega / Ultra / Jackpot 分级：
 * - 标题冲击字 + 赢取金额滚动计数
 * - 金币雨（Canvas 2D，对象池预分配，零运行时 GC）
 * - 光柱 / 烟雾 / 火花（同 Canvas 粒子池）
 * - 点击跳过
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "../i18n";
import { translate } from "../i18n";
import type { WinTier } from "../scene/types";
import type { QualityProfile } from "../quality";

export interface Celebration {
  tier: WinTier;
  amount: number;
  id: number;
}

/** 赢额相对总注的倍数 → 演出分级（纯表现层阈值） */
export function classifyWin(totalWin: number, totalBet: number): WinTier | null {
  if (totalBet <= 0 || totalWin <= 0) return null;
  const ratio = totalWin / totalBet;
  if (ratio >= 100) return "jackpot";
  if (ratio >= 50) return "ultra";
  if (ratio >= 20) return "mega";
  if (ratio >= 8) return "big";
  return null;
}

const TIER_STYLE: Record<WinTier, { className: string; coins: number; duration: number }> = {
  big: { className: "tier-big", coins: 90, duration: 4200 },
  mega: { className: "tier-mega", coins: 140, duration: 5600 },
  ultra: { className: "tier-ultra", coins: 190, duration: 7000 },
  jackpot: { className: "tier-jackpot", coins: 240, duration: 9000 },
};

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  life: number;
  maxLife: number;
  kind: "coin" | "spark" | "smoke";
}

/** 预分配粒子对象池 */
class ParticlePool {
  readonly items: Particle[];

  constructor(capacity: number) {
    this.items = Array.from({ length: capacity }, () => ({
      alive: false,
      x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0,
      size: 0, life: 0, maxLife: 0, kind: "coin" as const,
    }));
  }

  spawn(config: Partial<Particle> & { kind: Particle["kind"] }): void {
    const p = this.items.find((item) => !item.alive);
    if (!p) return;
    Object.assign(p, {
      alive: true,
      x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0,
      size: 6, life: 0, maxLife: 120,
    }, config);
  }

  forEachAlive(fn: (p: Particle) => void): void {
    for (const p of this.items) if (p.alive) fn(p);
  }
}

export default function WinCelebration({
  celebration,
  locale,
  quality,
  onDone,
}: {
  celebration: Celebration;
  locale: Locale;
  quality: QualityProfile;
  onDone: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [displayAmount, setDisplayAmount] = useState(0);
  const style = TIER_STYLE[celebration.tier];
  const titleKey = { big: "bigWin", mega: "megaWin", ultra: "ultraWin", jackpot: "jackpot" } as const;
  const title = translate(locale, titleKey[celebration.tier]);

  const moneyText = useMemo(
    () => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(displayAmount)} MMK`,
    [displayAmount],
  );

  // 金额滚动计数
  useEffect(() => {
    const start = performance.now();
    const countDur = Math.min(2600, style.duration * 0.55);
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / countDur);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplayAmount(Math.round(celebration.amount * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [celebration, style.duration]);

  // 粒子画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const budget = Math.min(style.coins, quality.coinBudget);
    const pool = new ParticlePool(quality.particleBudget + budget);
    let running = true;
    let raf = 0;
    let emitted = 0;
    let smokeTimer = 0;

    const emitCoin = () => {
      pool.spawn({
        kind: "coin",
        x: Math.random() * w,
        y: -20 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 60,
        vy: 140 + Math.random() * 160,
        vr: (Math.random() - 0.5) * 8,
        size: 7 + Math.random() * 9,
        maxLife: 400,
      });
    };
    const emitSpark = () => {
      const a = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 260;
      pool.spawn({
        kind: "spark",
        x: w / 2,
        y: h * 0.42,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 60,
        size: 2 + Math.random() * 2.5,
        maxLife: 40 + Math.random() * 30,
      });
    };
    const emitSmoke = () => {
      pool.spawn({
        kind: "smoke",
        x: w * (0.2 + Math.random() * 0.6),
        y: h + 30,
        vx: (Math.random() - 0.5) * 20,
        vy: -40 - Math.random() * 50,
        size: 60 + Math.random() * 80,
        maxLife: 200 + Math.random() * 120,
      });
    };

    let last = performance.now();
    const frame = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // 持续发射
      if (emitted < budget && Math.random() < 0.6) {
        for (let i = 0; i < 3; i += 1) emitCoin();
        emitted += 3;
      }
      if (celebration.tier !== "big" && Math.random() < 0.5) emitSpark();
      smokeTimer += dt;
      if (celebration.tier !== "big" && smokeTimer > 0.25) {
        emitSmoke();
        smokeTimer = 0;
      }

      ctx.clearRect(0, 0, w, h);
      pool.forEachAlive((p) => {
        p.life += dt * 60;
        if (p.life > p.maxLife || p.y > h + 80) {
          p.alive = false;
          return;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.kind === "coin") {
          p.vy += 240 * dt;
          const squish = Math.abs(Math.sin(p.rot * 2));
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(Math.max(0.15, squish), 1);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
          g.addColorStop(0, "#fff3b0");
          g.addColorStop(0.55, "#f5c542");
          g.addColorStop(1, "#a67c1a");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(120,80,10,0.8)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        } else if (p.kind === "spark") {
          p.vy += 300 * dt;
          const fade = 1 - p.life / p.maxLife;
          ctx.fillStyle = `rgba(255,${180 + Math.floor(fade * 60)},80,${fade})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const fade = 1 - p.life / p.maxLife;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, `rgba(200,190,170,${0.12 * fade})`);
          g.addColorStop(1, "rgba(200,190,170,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [celebration, quality, style]);

  // 到时自动结束
  useEffect(() => {
    const timer = window.setTimeout(onDone, style.duration);
    return () => window.clearTimeout(timer);
  }, [onDone, style.duration]);

  return (
    <div
      className={`win-celebration ${style.className}`}
      role="alert"
      onClick={onDone}
    >
      <div className="light-pillars" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </div>
      <canvas ref={canvasRef} className="celebration-canvas" aria-hidden="true" />
      <div className="celebration-center">
        <strong className="celebration-title">{title}</strong>
        <span className="celebration-amount">{moneyText}</span>
        <small className="celebration-skip">{translate(locale, "tapToContinue")}</small>
      </div>
    </div>
  );
}
