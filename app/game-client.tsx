"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import {
  notifyBootReady,
  notifyBootStarted,
  registerBootBridge,
} from "../client/xi-lobby/game-lifecycle.ts";

type BootHandle = {
  destroy: () => void;
  pause: (opts?: { releaseHeavyFx?: boolean }) => void;
  resume: () => void;
  ensureBootstrap: () => void;
  isBootstrapped: () => boolean;
};

/** Module singleton — at most one live M5 boot (no dual renderer / AudioContext). */
let activeHandle: BootHandle | null = null;
let bootSeq = 0;

function bumpGameClientCount(delta: number): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    __xiGameClientCount?: number;
    __xiCanvasCount?: number;
    __xiRafAlive?: number;
  };
  w.__xiGameClientCount = Math.max(0, (w.__xiGameClientCount ?? 0) + delta);
  w.__xiCanvasCount = document.querySelectorAll("canvas#gl").length;
  w.__xiRafAlive = w.__xiGameClientCount;
}

export type GameClientProps = {
  /** When true, WebGL boots without Session/Spin/Round until ensureBootstrap(). */
  deferBootstrap?: boolean;
};

/**
 * Formal commercial shell (M8) — mounts Three.js client.
 * Mobile-first full-bleed reels + commercial HUD. IDs preserved for Hud/boot.
 * No demo RNG / Mock on this path.
 * Soft-nav pause/resume via lifecycle bridge + `xi-game-pause` / `xi-game-resume`.
 */
export default function GameClient({ deferBootstrap = false }: GameClientProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const deferRef = useRef(deferBootstrap);
  deferRef.current = deferBootstrap;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const seq = ++bootSeq;
    let destroyed = false;
    let handle: BootHandle | null = null;

    // Tear down any leaked prior instance before re-boot
    if (activeHandle) {
      try {
        activeHandle.destroy();
      } catch {
        /* ignore */
      }
      activeHandle = null;
      bumpGameClientCount(-1);
    }

    notifyBootStarted();
    void import("../client/m5/boot.ts").then(({ bootM5 }) => {
      if (destroyed || seq !== bootSeq || !rootRef.current) return;
      handle = bootM5(rootRef.current, {
        deferBootstrap: deferRef.current,
      }) as BootHandle;
      activeHandle = handle;
      bumpGameClientCount(1);
      registerBootBridge({
        pause: (opts) => handle?.pause(opts),
        resume: () => handle?.resume(),
        ensureBootstrap: () => handle?.ensureBootstrap(),
        destroy: () => handle?.destroy(),
        isBootstrapped: () => handle?.isBootstrapped() ?? false,
      });
      notifyBootReady();
    });

    const onPause = () => {
      (handle ?? activeHandle)?.pause();
    };
    const onResume = () => {
      (handle ?? activeHandle)?.resume();
    };
    window.addEventListener("xi-game-pause", onPause);
    window.addEventListener("xi-game-resume", onResume);

    return () => {
      destroyed = true;
      window.removeEventListener("xi-game-pause", onPause);
      window.removeEventListener("xi-game-resume", onResume);
      registerBootBridge(null);
      try {
        handle?.destroy();
      } catch {
        /* ignore */
      }
      if (activeHandle === handle) activeHandle = null;
      if (handle) bumpGameClientCount(-1);
    };
  }, []);

  return (
    <div id="app" ref={rootRef} className="m5-root m7-commercial m8-commercial xi-mythic-slot">
      <canvas id="gl" />

      <div id="hud">
        {/* Mythic frame chrome — pointer-events none; never covers reel center; no #hud translateZ */}
        <div id="xi-mythic-chrome" aria-hidden>
          {/* Continuous 南天门 stage — portrait/landscape crops via CSS; never covers reel center */}
          <div className="xi-slot-nantianmen" data-testid="xi-nantianmen-stage" />
          <div className="xi-slot-nantianmen-veil" />
          <div className="xi-slot-sky" />
          <div className="xi-slot-mountains" />
          <div className="xi-slot-cloudsea" />
          <div className="xi-slot-palace" />
          <div className="xi-slot-flame-base" />
          <div className="xi-slot-thunder" />
          <div className="xi-slot-godlight" />
          <div className="xi-slot-spirit" />
          <div className="xi-slot-frame">
            <span className="xi-node n-tl" />
            <span className="xi-node n-tr" />
            <span className="xi-node n-bl" />
            <span className="xi-node n-br" />
            <span className="xi-horn left" />
            <span className="xi-horn right" />
            <span className="xi-array-edge" />
          </div>
        </div>

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
            <div className="top-actions">
              <button
                id="btn-profile"
                className="icon-btn metal"
                data-i18n-title="profile"
                title="个人中心"
                type="button"
                aria-label="Profile"
              >
                ☺
              </button>
              <button
                id="btn-vip"
                className="icon-btn metal"
                data-i18n-title="vip"
                title="VIP"
                type="button"
                aria-label="VIP"
              >
                ♛
              </button>
              <button
                id="btn-wallet"
                className="icon-btn metal"
                data-i18n-title="wallet"
                title="钱包"
                type="button"
                aria-label="Wallet"
              >
                ₮
              </button>
              <button
                id="btn-help"
                className="icon-btn metal"
                data-i18n-title="help"
                title="帮助"
                type="button"
                aria-label="Help"
              >
                ?
              </button>
              <button
                id="btn-back"
                className="icon-btn metal"
                data-i18n-title="back"
                title="返回"
                type="button"
                aria-label="Back"
              >
                ←
              </button>
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
            <div className="meter-chip win-chip">
              <span className="chip-icon ingot-icon" aria-hidden />
              <div className="chip-body">
                <label data-i18n="win">赢得</label>
                <div id="win" className="meter-value win">
                  0
                </div>
              </div>
            </div>
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
          <div className="xi-mythic-win" aria-hidden>
            <span className="xi-win-cloud" />
            <span className="xi-win-lotus" />
            <span className="xi-win-array" />
            <span className="xi-win-pillars" />
            <span className="xi-win-gate" />
          </div>
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
                  <button className="quality-btn" data-quality="ultra" type="button" data-i18n="qualityUltra">
                    旗舰
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
                <label data-i18n="fxEffects">特效</label>
                <div className="quality-switch">
                  <button className="quality-btn" data-fx="on" type="button" data-i18n="fxOn">
                    开
                  </button>
                  <button className="quality-btn" data-fx="off" type="button" data-i18n="fxOff">
                    关
                  </button>
                </div>
              </div>
              <div className="settings-row">
                <label data-i18n="animalAnim">动物动画</label>
                <div className="quality-switch">
                  <button className="quality-btn" data-animal="full" type="button" data-i18n="animalFull">
                    完整
                  </button>
                  <button className="quality-btn" data-animal="simple" type="button" data-i18n="animalSimple">
                    简化
                  </button>
                </div>
              </div>
              <div className="settings-row">
                <label data-i18n="fpsTarget">帧率</label>
                <div className="quality-switch">
                  <button className="quality-btn" data-fps="auto" type="button" data-i18n="fpsAuto">
                    自动
                  </button>
                  <button className="quality-btn" data-fps="30" type="button" data-i18n="fps30">
                    30
                  </button>
                  <button className="quality-btn" data-fps="60" type="button" data-i18n="fps60">
                    60
                  </button>
                </div>
              </div>
              <div className="settings-row">
                <label data-i18n="language">语言</label>
                <div id="settings-lang-switch" className="lang-metal settings-lang" data-testid="settings-lang">
                  <button className="lang-btn" data-lang="zh-CN" type="button">
                    中文
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
        </div>

        {/* Profile / VIP / Wallet / Help — close hides DOM only; never dispose #gl */}
        <div id="profile-modal" className="modal ab-commerce-modal hidden">
          <div className="modal-card glass-metal ab-purple-gold">
            <div className="modal-head">
              <span data-i18n="profile">个人中心</span>
              <button id="profile-close" className="icon-btn metal" type="button">
                ✕
              </button>
            </div>
            <div className="modal-body profile-body">
              <div className="profile-hero">
                <img id="profile-avatar-img" src="/avatars/ab-avatar-01.svg" alt="" width={72} height={72} />
                <div>
                  <div id="profile-nickname-display" className="profile-nick">
                    —
                  </div>
                  <div className="profile-meta">
                    <span data-i18n="profilePlayerId">玩家ID</span>: <b id="profile-playerid">—</b>
                  </div>
                </div>
              </div>
              <div className="profile-grid">
                <div>
                  <label data-i18n="profilePhone">手机</label>
                  <div id="profile-phone-display">—</div>
                </div>
                <div>
                  <label data-i18n="profileCurrency">币种</label>
                  <div id="profile-currency">MMK</div>
                </div>
                <div>
                  <label data-i18n="vip">VIP</label>
                  <div id="profile-vip">—</div>
                </div>
                <div>
                  <label data-i18n="profileStatus">状态</label>
                  <div id="profile-status">—</div>
                </div>
                <div>
                  <label data-i18n="profileRegistered">注册</label>
                  <div id="profile-registered">—</div>
                </div>
                <div>
                  <label data-i18n="profileLastLogin">最近登录</label>
                  <div id="profile-lastlogin">—</div>
                </div>
              </div>
              <div className="profile-edit">
                <label data-i18n="profileNickname">昵称</label>
                <div className="profile-edit-row">
                  <input id="profile-nickname-input" className="overlay-input" maxLength={24} />
                  <button id="profile-save-nick" className="console-btn metal" type="button" data-i18n="profileSave">
                    保存
                  </button>
                </div>
                <label data-i18n="profilePhone">手机 (E.164)</label>
                <div className="profile-edit-row">
                  <input id="profile-phone-input" className="overlay-input" placeholder="+959…" />
                  <button id="profile-save-phone" className="console-btn metal" type="button" data-i18n="profileBindPhone">
                    绑定
                  </button>
                </div>
                <label data-i18n="profileChooseAvatar">选择头像</label>
                <div id="avatar-grid" className="avatar-grid" />
              </div>
            </div>
          </div>
        </div>

        <div id="vip-modal" className="modal ab-commerce-modal hidden">
          <div className="modal-card glass-metal ab-purple-gold">
            <div className="modal-head">
              <span data-i18n="vipCenter">VIP 中心</span>
              <button id="vip-close" className="icon-btn metal" type="button">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div id="vip-status-line" className="vip-status-line">
                —
              </div>
              <div id="vip-level-switcher" className="vip-level-switcher" />
              <div id="vip-level-detail" />
              <h4 data-i18n="vipChests">奖励宝箱</h4>
              <div id="vip-chests" className="vip-chests" />
            </div>
          </div>
        </div>

        <div id="wallet-modal" className="modal ab-commerce-modal hidden">
          <div className="modal-card glass-metal ab-purple-gold">
            <div className="modal-head">
              <span data-i18n="wallet">钱包</span>
              <button id="wallet-close" className="icon-btn metal" type="button">
                ✕
              </button>
            </div>
            <div id="wallet-modal-body" className="modal-body" />
          </div>
        </div>

        <div id="help-modal" className="modal ab-commerce-modal hidden">
          <div className="modal-card glass-metal ab-purple-gold">
            <div className="modal-head">
              <span data-i18n="help">帮助中心</span>
              <button id="help-close" className="icon-btn metal" type="button">
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p data-i18n="helpIntro">牛魔王正式规则与客服入口。旋转结算以服务器为准。</p>
              <p className="overlay-note" data-i18n="helpPending">
                工单系统 Phase 8 — 规则详见赔付表与公告。
              </p>
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
