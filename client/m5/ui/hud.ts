/**
 * HUD — DOM overlay: meters, buttons, celebrations, formal paytable, language,
 * M6 quality / volume controls (presentation only).
 */
import type { Game, HudHooks } from "../game/game.ts";
import type { SymbolId, WinTier } from "../adapter.ts";
import { PAYTABLE, type RegularSymbol } from "../../../lib/game-config.ts";
import { symbolCanvas } from "../game/symbols.ts";
import { audio } from "../audio.ts";
import { t, setLang, getLang, onLangChange, applyDom, type Lang } from "../i18n.ts";
import type {
  AnimalAnimMode,
  FpsTarget,
  QualityMode,
  QualitySettings,
} from "../quality.ts";
import { CommerceOverlays } from "./overlays.ts";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function fmt(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

const PAYTABLE_ORDER: RegularSymbol[] = [
  "buffalo",
  "lion",
  "elephant",
  "zebra",
  "antelope",
  "a",
  "k",
  "q",
  "j",
  "ten",
  "nine",
];

export type HudQualityHooks = {
  getQualityMode: () => QualityMode;
  setQualityMode: (mode: QualityMode) => void;
  getQualitySettings?: () => QualitySettings;
  setQualitySettings?: (partial: Partial<QualitySettings>) => void;
};

export class Hud implements HudHooks {
  private game: Game;
  private toastTimer: number | null = null;
  private balanceShown = 0;
  private qualityHooks: HudQualityHooks | null = null;
  private commerce: CommerceOverlays | null = null;
  setQualityMode: ((mode: QualityMode) => void) | undefined;

  constructor(game: Game, qualityHooks?: HudQualityHooks) {
    this.game = game;
    this.qualityHooks = qualityHooks ?? null;
    this.setQualityMode = qualityHooks?.setQualityMode;
    game.attachHud(this);

    // Clear leftover full-screen traps from prior HMR / interrupted win FX
    this.releasePointerTraps();

    // Profile / VIP / Wallet / Help — DOM modals only (never dispose GL)
    this.commerce = new CommerceOverlays(game, () => {
      void this.game.refreshBalanceFromWallet();
    });

    $("btn-spin").addEventListener("click", () => {
      audio.unlock();
      audio.startBgm();
      void this.game.spin();
    });
    $("btn-auto").addEventListener("click", () => this.game.toggleAuto());
    $("btn-turbo").addEventListener("click", () => this.game.toggleTurbo());
    $("bet-plus").addEventListener("click", () => this.game.betUp());
    $("bet-minus").addEventListener("click", () => this.game.betDown());

    const backBtn = document.getElementById("btn-back");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        audio.uiClick();
        // Presentation-only leave — never mutates wallet / session settlement.
        // Play shell may set data-xi-play-leave=/xi/bull-demon-king and intercept via capture.
        const leaveHref =
          document.documentElement.getAttribute("data-xi-play-leave") ||
          document.querySelector<HTMLElement>(".xi-play-shell")?.getAttribute("data-xi-play-leave");
        if (leaveHref) {
          window.location.assign(leaveHref);
          return;
        }
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/";
      });
    }

    const soundBtn = $("btn-sound");
    soundBtn.addEventListener("click", () => {
      audio.unlock();
      const muted = !audio.isMuted;
      audio.setMuted(muted);
      soundBtn.classList.toggle("off", muted);
      soundBtn.classList.toggle("on", !muted);
      if (muted) audio.stopBgm();
      else {
        audio.startBgm();
        audio.uiClick();
      }
      this.syncSoundLabel();
    });

    document.querySelectorAll<HTMLButtonElement>(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        // Language switch is presentation-only — never spins / never new Session.
        setLang(btn.dataset.lang as Lang);
        audio.uiClick();
      });
    });
    onLangChange(() => {
      this.refreshStatic();
      this.buildPaytable();
    });

    $("btn-paytable").addEventListener("click", () => {
      audio.uiClick();
      this.buildPaytable();
      $("paytable-modal").classList.remove("hidden");
    });
    $("paytable-close").addEventListener("click", () =>
      $("paytable-modal").classList.add("hidden"),
    );
    $("paytable-modal").addEventListener("click", (e) => {
      if (e.target === $("paytable-modal")) $("paytable-modal").classList.add("hidden");
    });

    const settingsBtn = document.getElementById("btn-settings");
    const settingsModal = document.getElementById("settings-modal");
    const settingsClose = document.getElementById("settings-close");
    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener("click", () => {
        audio.uiClick();
        this.syncSettingsUi();
        settingsModal.classList.remove("hidden");
      });
      settingsClose?.addEventListener("click", () => settingsModal.classList.add("hidden"));
      settingsModal.addEventListener("click", (e) => {
        if (e.target === settingsModal) settingsModal.classList.add("hidden");
      });
    }

    document.querySelectorAll<HTMLButtonElement>(".quality-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.quality as QualityMode;
        if (!mode || !this.qualityHooks) return;
        audio.uiClick();
        this.qualityHooks.setQualityMode(mode);
        this.syncSettingsUi();
      });
    });

    document.querySelectorAll<HTMLButtonElement>("[data-fx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!this.qualityHooks?.setQualitySettings) return;
        audio.uiClick();
        this.qualityHooks.setQualitySettings({
          fxEnabled: btn.dataset.fx === "on",
        });
        this.syncSettingsUi();
      });
    });

    document.querySelectorAll<HTMLButtonElement>("[data-animal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!this.qualityHooks?.setQualitySettings) return;
        const mode = btn.dataset.animal as AnimalAnimMode;
        if (mode !== "full" && mode !== "simple") return;
        audio.uiClick();
        this.qualityHooks.setQualitySettings({ animalMode: mode });
        this.syncSettingsUi();
      });
    });

    document.querySelectorAll<HTMLButtonElement>("[data-fps]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!this.qualityHooks?.setQualitySettings) return;
        const raw = btn.dataset.fps;
        const fpsTarget: FpsTarget =
          raw === "30" ? 30 : raw === "60" ? 60 : "auto";
        audio.uiClick();
        this.qualityHooks.setQualitySettings({ fpsTarget });
        this.syncSettingsUi();
      });
    });

    const vol = document.getElementById("volume-slider") as HTMLInputElement | null;
    if (vol) {
      vol.value = String(Math.round(audio.getVolume() * 100));
      vol.addEventListener("input", () => {
        audio.unlock();
        audio.setVolume(Number(vol.value) / 100);
        if (audio.isMuted && Number(vol.value) > 0) {
          audio.setMuted(false);
          soundBtn.classList.remove("off");
          soundBtn.classList.add("on");
        }
      });
    }

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        audio.unlock();
        audio.startBgm();
        void this.game.spin();
      }
    });

    applyDom();
    this.refreshStatic();
    this.syncSettingsUi();
  }

  private syncSoundLabel(): void {
    const soundBtn = document.getElementById("btn-sound");
    if (!soundBtn) return;
    soundBtn.title = audio.isMuted ? t("unmute") : t("mute");
  }

  private syncSettingsUi(): void {
    this.syncSoundLabel();
    const mode = this.qualityHooks?.getQualityMode() ?? "auto";
    document.querySelectorAll<HTMLButtonElement>(".quality-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.quality === mode);
    });
    const settings = this.qualityHooks?.getQualitySettings?.();
    const fxOn = settings?.fxEnabled !== false;
    document.querySelectorAll<HTMLButtonElement>("[data-fx]").forEach((btn) => {
      btn.classList.toggle(
        "active",
        (btn.dataset.fx === "on") === fxOn,
      );
    });
    const animal = settings?.animalMode ?? "full";
    document.querySelectorAll<HTMLButtonElement>("[data-animal]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.animal === animal);
    });
    const fps = settings?.fpsTarget ?? "auto";
    document.querySelectorAll<HTMLButtonElement>("[data-fps]").forEach((btn) => {
      const raw = btn.dataset.fps;
      const match =
        (raw === "auto" && fps === "auto") ||
        (raw === "30" && fps === 30) ||
        (raw === "60" && fps === 60);
      btn.classList.toggle("active", match);
    });
    const vol = document.getElementById("volume-slider") as HTMLInputElement | null;
    if (vol) vol.value = String(Math.round(audio.getVolume() * 100));
  }

  setBalance(v: number, animate = false): void {
    const el = $("balance");
    if (animate && v !== this.balanceShown) {
      this.animateNumber(el, this.balanceShown, v, 600);
      el.classList.remove("bump");
      void el.offsetWidth;
      el.classList.add("bump");
    } else {
      el.textContent = fmt(v);
    }
    this.balanceShown = v;
    this.syncCurrency();
    this.syncSessionPill(true);
  }

  private syncCurrency(): void {
    const el = document.getElementById("currency");
    if (!el) return;
    const code = this.game.getCurrency();
    el.textContent = code;
  }

  private syncSessionPill(online: boolean): void {
    const pill = document.getElementById("session-pill");
    if (!pill) return;
    pill.classList.toggle("offline", !online);
    const label = pill.querySelector(".session-label");
    if (label) label.textContent = online ? "OK" : "…";
  }

  setBet(v: number): void {
    const el = $("bet");
    el.textContent = fmt(v);
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  showWin(amount: number): void {
    const el = $("win");
    this.animateNumber(el, 0, amount, amount > 0 ? 900 : 0);
    if (amount > 0) {
      el.classList.remove("bump");
      void el.offsetWidth;
      el.classList.add("bump");
    }
  }

  flashMeters(level: 0 | 1 | 2 | 3): void {
    if (level <= 0) return;
    const ids = ["balance", "win", "bet", "console"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.classList.remove("hud-flash", "hud-flash-gold", "hud-flash-max");
      void el.offsetWidth;
      if (level >= 3) el.classList.add("hud-flash-max");
      else if (level >= 2) el.classList.add("hud-flash-gold");
      else el.classList.add("hud-flash");
    }
  }

  setFreeSpins(n: number): void {
    const badge = $("fs-badge");
    badge.classList.toggle("hidden", n <= 0);
    $("fs-count").textContent = String(n);
  }

  toastKey(key: string): void {
    this.toastMessage(t(key));
  }

  toastMessage(message: string): void {
    const el = $("toast");
    el.textContent = message;
    el.classList.remove("hidden");
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.add("hidden"), 2200);
  }

  setSessionOnline(online: boolean): void {
    this.syncSessionPill(online);
  }

  setSpinBusy(busy: boolean): void {
    const btn = $("btn-spin") as HTMLButtonElement;
    btn.disabled = busy;
    btn.classList.toggle("busy", busy);
    ($("bet-plus") as HTMLButtonElement).disabled = busy;
    ($("bet-minus") as HTMLButtonElement).disabled = busy;
    const spinLabel = document.getElementById("spin-label");
    if (spinLabel) spinLabel.textContent = busy ? t("spinning") : t("spin");
  }

  /** Hide inert overlays that can swallow the entire HUD hit target. */
  releasePointerTraps(): void {
    for (const id of [
      "celebration",
      "jackpot-banner",
      "paytable-modal",
      "settings-modal",
      "profile-modal",
      "vip-modal",
      "wallet-modal",
      "help-modal",
    ]) {
      document.getElementById(id)?.classList.add("hidden");
    }
    document.getElementById("loading")?.classList.add("done");
    this.commerce?.hideAll();
  }

  setAutoActive(on: boolean): void {
    const btn = $("btn-auto");
    btn.classList.toggle("active", on);
    btn.textContent = on ? t("autoOn") : t("auto");
  }

  setTurboActive(on: boolean): void {
    $("btn-turbo").classList.toggle("active", on);
  }

  refreshStatic(): void {
    applyDom();
    const autoBtn = $("btn-auto");
    autoBtn.textContent = autoBtn.classList.contains("active") ? t("autoOn") : t("auto");
    const spinLabel = document.getElementById("spin-label");
    if (spinLabel && $("btn-spin").classList.contains("busy")) {
      spinLabel.textContent = t("spinning");
    }
    this.syncSettingsUi();
  }

  async celebrate(tier: WinTier, amount: number): Promise<void> {
    if (tier === "jackpot") {
      return this.celebrateJackpot(amount);
    }
    const overlay = $("celebration");
    const tierEl = $("celebration-tier");
    const amountEl = $("celebration-amount");
    const tierClasses = [
      "tier-big",
      "tier-mega",
      "tier-ultra",
      "tier-super",
      "tier-epic",
      "tier-jackpot",
    ];
    try {
      const key =
        tier === "big"
          ? "bigWin"
          : tier === "mega"
            ? "megaWin"
            : tier === "ultra"
              ? "ultraWin"
              : tier === "super"
                ? "superWin"
                : tier === "epic"
                  ? "epicWin"
                  : "ultraWin";
      tierEl.textContent = t(key);
      overlay.classList.remove("hidden", ...tierClasses);
      overlay.classList.add(`tier-${tier}`);
      if (tier === "super" || tier === "epic") {
        overlay.classList.add("hud-all-gold");
      } else {
        overlay.classList.remove("hud-all-gold");
      }
      tierEl.style.animation = "none";
      void tierEl.offsetWidth;
      tierEl.style.animation = "";
      const dur =
        tier === "big"
          ? 2800
          : tier === "mega"
            ? 3600
            : tier === "ultra"
              ? 4400
              : tier === "super"
                ? 5200
                : 6200;
      this.animateNumber(amountEl, 0, amount, Math.min(dur - 400, 3200));
      this.flashMeters(tier === "epic" || tier === "super" ? 3 : 2);
      // Tap-to-skip after short minimum (does not alter win amount)
      const minHold = 900;
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          overlay.removeEventListener("click", onTap);
          window.clearTimeout(timer);
          resolve();
        };
        const onTap = () => finish();
        const timer = window.setTimeout(finish, dur);
        window.setTimeout(() => overlay.addEventListener("click", onTap), minHold);
      });
    } finally {
      overlay.classList.add("hidden");
      overlay.classList.remove(...tierClasses, "hud-all-gold");
    }
  }

  private async celebrateJackpot(amount: number): Promise<void> {
    const banner = $("jackpot-banner");
    try {
      $("jackpot-amount").textContent = "0";
      banner.classList.remove("hidden");
      banner.classList.add("hud-all-gold", "jackpot-ultimate");
      this.animateNumber($("jackpot-amount"), 0, amount, 3600);
      this.flashMeters(3);
      await new Promise((r) => setTimeout(r, 7200));
    } finally {
      banner.classList.add("hidden");
      banner.classList.remove("hud-all-gold", "jackpot-ultimate");
    }
  }

  private animateNumber(el: HTMLElement, from: number, to: number, dur: number): void {
    if (dur <= 0 || from === to) {
      el.textContent = fmt(to);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private buildPaytable(): void {
    const body = $("paytable-body");
    body.innerHTML = "";
    for (const sym of PAYTABLE_ORDER) {
      const pays = PAYTABLE[sym];
      const row = document.createElement("div");
      row.className = "pay-row";
      const img = document.createElement("img");
      img.src = symbolCanvas(sym).toDataURL();
      img.alt = t(`sym_${sym}`);
      const name = document.createElement("span");
      name.className = "pay-name";
      name.textContent = t(`sym_${sym}`);
      const vals = document.createElement("span");
      vals.className = "pay-vals";
      const parts = ([2, 3, 4, 5] as const)
        .map((n) => (pays[n] != null ? `×${n} ${pays[n]}` : null))
        .filter(Boolean);
      vals.textContent = parts.join(" · ");
      row.append(img, name, vals);
      body.appendChild(row);
    }
    for (const sym of ["wild", "scatter"] as SymbolId[]) {
      const row = document.createElement("div");
      row.className = "pay-row";
      const img = document.createElement("img");
      img.src = symbolCanvas(sym).toDataURL();
      img.alt = t(`sym_${sym}`);
      const name = document.createElement("span");
      name.className = "pay-name";
      name.textContent = t(`sym_${sym}`);
      row.append(img, name);
      body.appendChild(row);
    }
    for (const noteKey of ["wildNote", "scatterNote", "linesNote"]) {
      const note = document.createElement("div");
      note.className = "pay-note";
      note.textContent = t(noteKey);
      body.appendChild(note);
    }
  }
}

export function currentLang(): Lang {
  return getLang();
}
