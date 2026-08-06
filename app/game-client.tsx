"use client";

import { useEffect, useRef } from "react";

/**
 * Formal M5 shell — mounts the integrated Three.js client.
 * Local demo outcome generation is removed from the runtime path.
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
    <div id="app" ref={rootRef} className="m5-root">
      <canvas id="gl" />

      <div id="hud">
        <div id="topbar" className="hud-panel">
          <div id="logo">
            <span className="logo-horn" />
            <span id="logo-text" data-i18n="gameTitle">
              亚洲水牛
            </span>
          </div>
          <div id="fs-badge" className="hidden">
            <span className="fs-star">✦</span>
            <span data-i18n="freeSpins">免费旋转</span>
            <b id="fs-count">0</b>
          </div>
          <div className="top-actions">
            <button
              id="btn-paytable"
              className="icon-btn"
              data-i18n-title="paytable"
              title="赔付表"
              type="button"
            >
              ⓘ
            </button>
            <button
              id="btn-sound"
              className="icon-btn on"
              data-i18n-title="sound"
              title="音效"
              type="button"
            >
              ♪
            </button>
            <div id="lang-switch">
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

        <div id="jackpot-banner" className="hidden">
          <div className="jackpot-rays" />
          <div className="jackpot-text" data-i18n="jackpot">
            超级头奖
          </div>
          <div id="jackpot-amount">0</div>
        </div>

        <div id="console" className="hud-panel">
          <div className="meter">
            <label data-i18n="balance">余额</label>
            <div id="balance" className="meter-value">
              0
            </div>
          </div>
          <div className="meter bet-meter">
            <label data-i18n="bet">投注</label>
            <div className="bet-row">
              <button id="bet-minus" className="step-btn" type="button">
                −
              </button>
              <div id="bet" className="meter-value gold">
                50
              </div>
              <button id="bet-plus" className="step-btn" type="button">
                +
              </button>
            </div>
          </div>
          <div className="meter">
            <label data-i18n="win">赢得</label>
            <div id="win" className="meter-value win">
              0
            </div>
          </div>
          <div className="console-actions">
            <button id="btn-turbo" className="console-btn" data-i18n="turbo" type="button">
              快速
            </button>
            <button id="btn-auto" className="console-btn" data-i18n="auto" type="button">
              自动
            </button>
            <button id="btn-spin" className="spin-btn" type="button">
              <span className="spin-ring" />
              <span id="spin-label" data-i18n="spin">
                旋转
              </span>
            </button>
          </div>
        </div>

        <div id="celebration" className="hidden">
          <div className="celebration-glow" />
          <div id="celebration-tier" className="celebration-tier">
            BIG WIN
          </div>
          <div id="celebration-amount" className="celebration-amount">
            0
          </div>
        </div>

        <div id="toast" className="hidden" />

        <div id="paytable-modal" className="modal hidden">
          <div className="modal-card">
            <div className="modal-head">
              <span data-i18n="paytable">赔付表</span>
              <button id="paytable-close" className="icon-btn" type="button">
                ✕
              </button>
            </div>
            <div id="paytable-body" className="modal-body" />
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
