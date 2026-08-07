"use client";

/**
 * M6-3 · 赔付线连线动画
 * 覆盖在转轴窗口上的 SVG 层：命中线以流光描边依次绘制。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Payline } from "../../../lib/game-config";

export interface ActivePayline {
  line: number;
  count: number;
}

const LINE_COLORS = ["#ffd36a", "#7fe7c4", "#ff9d6a", "#c49bff", "#7fc4ff"];

export default function PaylineOverlay({
  paylines,
  wins,
  active,
}: {
  paylines: readonly Payline[];
  wins: ActivePayline[];
  active: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 多条命中线轮播展示
  useEffect(() => {
    if (!active || wins.length <= 1) {
      setCycle(0);
      return;
    }
    const timer = window.setInterval(() => {
      setCycle((c) => (c + 1) % wins.length);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [active, wins.length]);

  const path = useMemo(() => {
    if (!active || wins.length === 0 || size.w === 0) return null;
    const win = wins[cycle % wins.length];
    const line = paylines[win.line - 1];
    if (!line) return null;
    const cellW = size.w / 5;
    const cellH = size.h / 4;
    const points = line.slice(0, win.count).map((row, reel) => ({
      x: cellW * reel + cellW / 2,
      y: cellH * row + cellH / 2,
    }));
    return { points, color: LINE_COLORS[(win.line - 1) % LINE_COLORS.length], line: win.line };
  }, [active, wins, cycle, paylines, size]);

  return (
    <div ref={wrapRef} className="payline-overlay" aria-hidden="true">
      {path ? (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none">
          <polyline
            key={`${path.line}-${cycle}`}
            className="payline-stroke"
            points={path.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={path.color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {path.points.map((p, i) => (
            <circle
              key={`${path.line}-dot-${i}`}
              className="payline-dot"
              cx={p.x}
              cy={p.y}
              r={7}
              fill={path.color}
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}
