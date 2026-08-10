"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Formal commercial shell (M8) — mounts Three.js client.
 * Mobile-first full-bleed reels + commercial HUD. IDs preserved for Hud/boot.
 * No demo RNG / Mock on this path.
 */
export default function GameClient() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let destroyed = false;
    let handle: { destroy: () => void } | null = null;

    void import("../client/m5/boot.ts").then(({ bootM5 }) => {
      if (destroyed || !rootRef.current) return;
      handle = bootM5(rootRef.current);
    });

    return () => {
      destroyed = true;
      handle?.destroy();
    };
  }, []);

  return (
    <div id="app" ref={rootRef} className="m5-root m7-commercial m8-commercial">
      <canvas id="gl" />

      <div id="hud">
        {/* ===== TOP COMMERCIAL HUD ===== */}
        <div id="topbar" className="hud-panel top-commercial">
          <div className="top-left-cluster">
            <div id="logo" className="brand-seal" aria-label="Bull Demon King">
              <span className="logo-horn" />
              <span id="logo-text" className="brand-title" data-i18n="gameTitle">
                牛魔王
              </span>
            </div>
            <div className="meter-chip balance-chip">
              <span className="chip-icon coin-icon" aria-hidden />
              <div className="chip-body">
                <label>
                  <span data-i18n="balance">余额</span>
                  <span id="currency" className="currency-tag">
                    MMK
                  </span>
                </label>
                <div id="balance" className="meter-value">
                  0
                </div>
              </div>
            </div>
            <div
              id="session-pill"
              className="session-pill metal"
              data-i18n-title="session"
              title="Session"
            >
              <span className="session-dot" aria-hidden />
              <span className="session-label">OK</span>
            </div>
          </div>

          <div className="top-center-cluster">
            <div id="fs-badge" className="hidden fs-banner">
              <span className="fs-star">✦</span>
              <span data-i18n="freeSpins">免费旋转</span>
              <b id="fs-count">0</b>
            </div>
            <div className="brand-ribbon" aria-hidden>
              <span className="ribbon-jade" data-i18n="goodLuck">
                祝好运！
              </span>
              <span className="ribbon-gold" data-i18n="lines">
                50 线
              </span>
            </div>
          </div>

          <div className="top-right-cluster">
            <div className="meter-chip win-chip">
              <span className="chip-icon ingot-icon" aria-hidden />
              <div className="chip-body">
                <label data-i18n="win">赢得</label>
                <div id="win" className="meter-value win">
                  0
                </div>
              </div>
            </div>
            <div className="top-actions">
              <button
                id="btn-paytable"
                className="icon-btn metal"
                data-i18n-title="paytable"
                title="赔付表"
                type="button"
              >
                ⓘ
              </button>
              <button
                id="btn-sound"
                className="icon-btn metal on"
                data-i18n-title="sound"
                title="音效"
                type="button"
              >
                ♪
              </button>
              <button
                id="btn-settings"
                className="icon-btn metal gear"
                data-i18n-title="settings"
                title="设置"
                type="button"
              >
                ⚙
              </button>
              <div id="lang-switch" className="lang-metal">
                <button className="lang-btn" data-lang="zh-CN" type="button">
                  中
                </button>
                <button className="lang-btn" data-lang="en" type="button">
                  EN
                </button>
                <button className="lang-btn" data-lang="my-MM" type="button">
                  မြန်မာ
                </button>
              </div>
            </div>
          </div>
        </div>

        <div id="jackpot-banner" className="hidden">
          <div className="jackpot-rays" />
          <div className="jackpot-text" data-i18n="jackpot">
            超级头奖
          </div>
          <div id="jackpot-amount">0</div>
        </div>

        {/* ===== BOTTOM COMMERCIAL CONSOLE ===== */}
        <div id="console" className="hud-panel bottom-commercial">
          <div className="console-left">
            <div className="meter-chip bet-chip">
              <label data-i18n="bet">投注</label>
              <div className="bet-row">
                <button id="bet-minus" className="step-btn metal" type="button">
                  −
                </button>
                <div id="bet" className="meter-value gold">
                  50
                </div>
                <button id="bet-plus" className="step-btn metal" type="button">
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="console-center">
            <button id="btn-turbo" className="console-btn metal" data-i18n="turbo" type="button">
              快速
            </button>
            <button id="btn-auto" className="console-btn metal" data-i18n="auto" type="button">
              自动
            </button>
          </div>

          <div className="console-right">
            <button id="btn-spin" className="spin-btn commercial-spin" type="button">
              <span className="spin-ring" />
              <span className="spin-core">
                <span id="spin-label" data-i18n="spin">
                  旋转
                </span>
              </span>
            </button>
          </div>
        </div>

        <div id="celebration" className="hidden">
          <div className="celebration-rays" aria-hidden />
          <div className="celebration-glow" />
          <div className="celebration-coins" aria-hidden>
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} className="celebration-coin" style={{ "--i": i } as CSSProperties} />
            ))}
          </div>
          <div className="celebration-frame">
            <div id="celebration-tier" className="celebration-tier">
              BIG WIN
            </div>
            <div id="celebration-amount" className="celebration-amount">
              0
            </div>
          </div>
          <div className="celebration-hint" data-i18n="tapToContinue">
            点击继续
          </div>
        </div>

        <div id="toast" className="hidden" />

        <div id="paytable-modal" className="modal hidden">
          <div className="modal-card glass-metal">
            <div className="modal-head">
              <span data-i18n="paytable">赔付表</span>
              <button id="paytable-close" className="icon-btn metal" type="button">
                ✕
              </button>
            </div>
            <div id="paytable-body" className="modal-body" />
          </div>
        </div>

        <div id="settings-modal" className="modal hidden">
          <div className="modal-card settings-card glass-metal">
            <div className="modal-head">
              <span data-i18n="settings">设置</span>
              <button id="settings-close" className="icon-btn metal" type="button">
                ✕
              </button>
            </div>
            <div className="modal-body settings-body">
              <div className="settings-row">
                <label data-i18n="volume">音量</label>
                <input
                  id="volume-slider"
                  type="range"
                  min={0}
                  max={100}
                  defaultValue={80}
                  aria-label="volume"
                />
              </div>
              <div className="settings-row">
                <label data-i18n="quality">画质</label>
                <div id="quality-switch" className="quality-switch">
                  <button className="quality-btn" data-quality="auto" type="button" data-i18n="qualityAuto">
                    自动
                  </button>
                  <button className="quality-btn" data-quality="high" type="button" data-i18n="qualityHigh">
                    高
                  </button>
                  <button className="quality-btn" data-quality="medium" type="button" data-i18n="qualityMedium">
                    中
                  </button>
                  <button className="quality-btn" data-quality="low" type="button" data-i18n="qualityLow">
                    低
                  </button>
                </div>
              </div>
              <div className="settings-row">
                <label data-i18n="language">语言</label>
                <div className="settings-hint" data-i18n="tapToContinue">
                  点击继续
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="loading">
          <div className="loading-emblem" />
          <div id="loading-text" data-i18n="loading">
            正在进入草原…
          </div>
        </div>
      </div>
    </div>
  );
}
