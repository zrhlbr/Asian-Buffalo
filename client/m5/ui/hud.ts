/**
 * HUD — DOM overlay: meters, buttons, celebrations, formal paytable, language.
 */
import type { Game, HudHooks } from "../game/game.ts";
import type { SymbolId, WinTier } from "../adapter.ts";
import { PAYTABLE, type RegularSymbol } from "../../../lib/game-config.ts";
import { symbolCanvas } from "../game/symbols.ts";
import { audio } from "../audio.ts";
import { t, setLang, getLang, onLangChange, applyDom, type Lang } from "../i18n.ts";

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

export class Hud implements HudHooks {
  private game: Game;
  private toastTimer: number | null = null;
  private balanceShown = 0;

  constructor(game: Game) {
    this.game = game;
    game.attachHud(this);

    $("btn-spin").addEventListener("click", () => {
      audio.unlock();
      audio.startBgm();
      void this.game.spin();
    });
    $("btn-auto").addEventListener("click", () => this.game.toggleAuto());
    $("btn-turbo").addEventListener("click", () => this.game.toggleTurbo());
    $("bet-plus").addEventListener("click", () => this.game.betUp());
    $("bet-minus").addEventListener("click", () => this.game.betDown());

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
    });

    document.querySelectorAll<HTMLButtonElement>(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
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

  setFreeSpins(n: number): void {
    const badge = $("fs-badge");
    badge.classList.toggle("hidden", n <= 0);
    $("fs-count").textContent = String(n);
  }

  toastKey(key: string): void {
    const el = $("toast");
    el.textContent = t(key);
    el.classList.remove("hidden");
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.add("hidden"), 2200);
  }

  setSpinBusy(busy: boolean): void {
    const btn = $("btn-spin") as HTMLButtonElement;
    btn.disabled = busy;
    btn.classList.toggle("busy", busy);
    ($("bet-plus") as HTMLButtonElement).disabled = busy;
    ($("bet-minus") as HTMLButtonElement).disabled = busy;
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
  }

  async celebrate(tier: WinTier, amount: number): Promise<void> {
    if (tier === "jackpot") {
      return this.celebrateJackpot(amount);
    }
    const overlay = $("celebration");
    const tierEl = $("celebration-tier");
    const amountEl = $("celebration-amount");
    const key = tier === "big" ? "bigWin" : tier === "mega" ? "megaWin" : "ultraWin";
    tierEl.textContent = t(key);
    overlay.classList.remove("hidden");
    tierEl.style.animation = "none";
    void tierEl.offsetWidth;
    tierEl.style.animation = "";
    const dur = tier === "big" ? 2600 : tier === "mega" ? 3400 : 4200;
    this.animateNumber(amountEl, 0, amount, Math.min(dur - 400, 2000));
    await new Promise((r) => setTimeout(r, dur));
    overlay.classList.add("hidden");
  }

  private async celebrateJackpot(amount: number): Promise<void> {
    const banner = $("jackpot-banner");
    $("jackpot-amount").textContent = "0";
    banner.classList.remove("hidden");
    this.animateNumber($("jackpot-amount"), 0, amount, 2400);
    await new Promise((r) => setTimeout(r, 5500));
    banner.classList.add("hidden");
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
