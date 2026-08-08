/**
 * In-game commerce overlays — Profile / VIP / Wallet(help stub) / Help.
 * DOM modals only; never dispose WebGL. Block money-risk opens while spinning.
 */
import type { Game } from "../game/game.ts";
import { audio } from "../audio.ts";
import { t, getLang, onLangChange } from "../i18n.ts";

type ProfileDto = {
  playerId: string;
  nickname: string;
  avatarId: string;
  avatarUrl: string;
  phoneMasked: string | null;
  phoneE164: string | null;
  phoneVerified: boolean;
  currency: string;
  supportedCurrencies: string[];
  status: string;
  registeredAt: string;
  lastLoginAt: string | null;
  vipLevel: number;
  vipStatus: string;
  vipBadge: string | null;
};

type VipLevel = {
  level: number;
  code: string;
  title: Record<string, string>;
  unlocked: boolean;
  locked: boolean;
  conditions: Record<string, unknown>;
};

type Chest = {
  id: string;
  kind: string;
  title: Record<string, string>;
  amountMinor: number;
  currency: string;
  claimable: boolean;
  claimed: boolean;
  lockedReason: string | null;
};

const $ = <T extends HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: { code?: string; message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message ?? data.error?.code ?? `HTTP ${res.status}`);
  }
  return data;
}

function langTitle(title: Record<string, string> | undefined): string {
  if (!title) return "";
  const lang = getLang();
  return title[lang] ?? title.en ?? title["zh-CN"] ?? Object.values(title)[0] ?? "";
}

function hide(id: string): void {
  $(id)?.classList.add("hidden");
}

function show(id: string): void {
  $(id)?.classList.remove("hidden");
}

export class CommerceOverlays {
  private game: Game;
  private profile: ProfileDto | null = null;
  private vipLevels: VipLevel[] = [];
  private chests: Chest[] = [];
  private selectedVipLevel = 1;
  private onBalanceRefresh: (() => void) | null = null;

  constructor(game: Game, onBalanceRefresh?: () => void) {
    this.game = game;
    this.onBalanceRefresh = onBalanceRefresh ?? null;
    this.bindChrome();
    onLangChange(() => {
      if (!$("profile-modal")?.classList.contains("hidden")) void this.renderProfile();
      if (!$("vip-modal")?.classList.contains("hidden")) void this.renderVip();
    });
  }

  private busyBlocked(moneyRisk: boolean): boolean {
    if (!this.game.busy) return false;
    // During spin: block high-risk money modals; help/profile wait until spin ends.
    void moneyRisk;
    return true;
  }

  private bindChrome(): void {
    const openProfile = $("btn-profile");
    openProfile?.addEventListener("click", () => {
      audio.uiClick();
      if (this.busyBlocked(true)) {
        this.toast(t("overlayWaitSpin"));
        return;
      }
      void this.openProfile();
    });

    const openVip = $("btn-vip");
    openVip?.addEventListener("click", () => {
      audio.uiClick();
      if (this.busyBlocked(true)) {
        this.toast(t("overlayWaitSpin"));
        return;
      }
      void this.openVip();
    });

    const openHelp = $("btn-help");
    openHelp?.addEventListener("click", () => {
      audio.uiClick();
      if (this.busyBlocked(false)) {
        this.toast(t("overlayWaitSpin"));
        return;
      }
      show("help-modal");
    });

    const openWallet = $("btn-wallet");
    openWallet?.addEventListener("click", () => {
      audio.uiClick();
      if (this.busyBlocked(true)) {
        this.toast(t("overlayWaitSpin"));
        return;
      }
      void this.openWallet();
    });

    for (const [modal, close] of [
      ["profile-modal", "profile-close"],
      ["vip-modal", "vip-close"],
      ["wallet-modal", "wallet-close"],
      ["help-modal", "help-close"],
    ] as const) {
      $(close)?.addEventListener("click", () => hide(modal));
      $(modal)?.addEventListener("click", (e) => {
        if (e.target === $(modal)) hide(modal);
      });
    }

    $("profile-save-nick")?.addEventListener("click", () => void this.saveNickname());
    $("profile-save-phone")?.addEventListener("click", () => void this.savePhone());
  }

  private toast(msg: string): void {
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    window.setTimeout(() => el.classList.add("hidden"), 2200);
  }

  async openProfile(): Promise<void> {
    show("profile-modal");
    await this.loadProfile();
    this.renderProfile();
  }

  async openVip(): Promise<void> {
    show("vip-modal");
    await this.loadVip();
    this.renderVip();
  }

  async openWallet(): Promise<void> {
    show("wallet-modal");
    const body = $("wallet-modal-body");
    if (!body) return;
    body.innerHTML = `<p class="overlay-note">${t("loading")}</p>`;
    try {
      const data = await api<{
        wallet: {
          availableMinor: number;
          frozenMinor: number;
          currency: string;
          status: string;
          recentMoves: Array<{
            id: string;
            label: string;
            status: string;
            amountMinor: number;
            createdAt: string;
          }>;
        };
      }>("/api/v1/game/wallet");
      const w = data.wallet;
      const moves = (w.recentMoves ?? [])
        .slice(0, 8)
        .map(
          (m) =>
            `<li><strong>${m.label} · ${m.status}</strong><div>${m.amountMinor} · ${m.createdAt}</div></li>`,
        )
        .join("");
      body.innerHTML = `
        <p class="overlay-note">${t("walletAvailable")}: <b>${w.availableMinor}</b> ${w.currency}</p>
        <p class="overlay-note">${t("walletFrozen")}: <b>${w.frozenMinor}</b></p>
        <p class="overlay-note">${t("walletStatus")}: ${w.status}</p>
        <p class="overlay-note">${t("walletPending")}</p>
        <ul class="overlay-list">${moves || `<li>${t("walletNoMoves")}</li>`}</ul>
      `;
    } catch (cause) {
      body.innerHTML = `<p class="overlay-note">${cause instanceof Error ? cause.message : t("errorGeneric")}</p>`;
    }
  }

  private async loadProfile(): Promise<void> {
    try {
      const data = await api<{ profile: ProfileDto; avatars: Array<{ id: string; url: string }> }>(
        "/api/v1/game/profile",
      );
      this.profile = data.profile;
      const grid = $("avatar-grid");
      if (grid) {
        grid.innerHTML = data.avatars
          .map(
            (a) =>
              `<button type="button" class="avatar-pick${a.id === data.profile.avatarId ? " active" : ""}" data-avatar="${a.id}" title="${a.id}">
                <img src="${a.url}" alt="" width="56" height="56" />
              </button>`,
          )
          .join("");
        grid.querySelectorAll<HTMLButtonElement>(".avatar-pick").forEach((btn) => {
          btn.addEventListener("click", () => void this.pickAvatar(btn.dataset.avatar ?? ""));
        });
      }
    } catch (cause) {
      this.toast(cause instanceof Error ? cause.message : t("errorGeneric"));
    }
  }

  private renderProfile(): void {
    const p = this.profile;
    if (!p) return;
    const set = (id: string, text: string) => {
      const el = $(id);
      if (el) el.textContent = text;
    };
    set("profile-nickname-display", p.nickname);
    set("profile-playerid", p.playerId);
    set("profile-phone-display", p.phoneMasked ?? t("profilePhoneNone"));
    set("profile-currency", `${p.currency} (${p.supportedCurrencies.join(" / ")})`);
    set("profile-vip", p.vipBadge ? `${p.vipBadge} · L${p.vipLevel}` : `L${p.vipLevel} · ${p.vipStatus}`);
    set("profile-registered", p.registeredAt || "—");
    set("profile-lastlogin", p.lastLoginAt || "—");
    set("profile-status", p.status);
    const img = $("profile-avatar-img") as HTMLImageElement | null;
    if (img) img.src = p.avatarUrl;
    const nickInput = $("profile-nickname-input") as HTMLInputElement | null;
    if (nickInput && !nickInput.value) nickInput.value = p.nickname;
    const phoneInput = $("profile-phone-input") as HTMLInputElement | null;
    if (phoneInput && p.phoneE164) phoneInput.value = p.phoneE164;
  }

  private async saveNickname(): Promise<void> {
    const nickInput = $("profile-nickname-input") as HTMLInputElement | null;
    const nickname = nickInput?.value?.trim() ?? "";
    try {
      const data = await api<{ profile: ProfileDto }>("/api/v1/game/profile", {
        method: "PATCH",
        body: JSON.stringify({ nickname }),
      });
      this.profile = data.profile;
      this.renderProfile();
      this.toast(t("profileSaved"));
    } catch (cause) {
      this.toast(cause instanceof Error ? cause.message : t("errorGeneric"));
    }
  }

  private async pickAvatar(avatarId: string): Promise<void> {
    if (!avatarId) return;
    try {
      const data = await api<{ profile: ProfileDto }>("/api/v1/game/profile/avatar", {
        method: "POST",
        body: JSON.stringify({ avatarId }),
      });
      this.profile = data.profile;
      await this.loadProfile();
      this.renderProfile();
      this.toast(t("profileSaved"));
    } catch (cause) {
      this.toast(cause instanceof Error ? cause.message : t("errorGeneric"));
    }
  }

  private async savePhone(): Promise<void> {
    const phoneInput = $("profile-phone-input") as HTMLInputElement | null;
    const phoneE164 = phoneInput?.value?.trim() ?? "";
    try {
      const data = await api<{ profile: ProfileDto }>("/api/v1/game/profile/phone", {
        method: "POST",
        body: JSON.stringify({ phoneE164 }),
      });
      this.profile = data.profile;
      this.renderProfile();
      this.toast(t("profilePhonePending"));
    } catch (cause) {
      this.toast(cause instanceof Error ? cause.message : t("errorGeneric"));
    }
  }

  private async loadVip(): Promise<void> {
    try {
      const levels = await api<{
        vip: { level: number; status: string; levels: VipLevel[] };
      }>("/api/v1/game/vip/levels");
      this.vipLevels = levels.vip.levels;
      this.selectedVipLevel = Math.max(1, levels.vip.level || 1);
      const rewards = await api<{ chests: Chest[] }>("/api/v1/game/vip/rewards");
      this.chests = rewards.chests;
      const statusEl = $("vip-status-line");
      if (statusEl) {
        statusEl.textContent = `VIP ${levels.vip.level} · ${levels.vip.status}`;
      }
    } catch (cause) {
      this.toast(cause instanceof Error ? cause.message : t("errorGeneric"));
    }
  }

  private renderVip(): void {
    const switcher = $("vip-level-switcher");
    if (switcher) {
      switcher.innerHTML = [1, 2, 3, 4, 5, 6]
        .map((lv) => {
          const meta = this.vipLevels.find((x) => x.level === lv);
          const locked = meta?.locked ?? true;
          return `<button type="button" class="vip-lv-btn${lv === this.selectedVipLevel ? " active" : ""}${locked ? " locked" : " unlocked"}" data-lv="${lv}">VIP ${lv}</button>`;
        })
        .join("");
      switcher.querySelectorAll<HTMLButtonElement>(".vip-lv-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.selectedVipLevel = Number(btn.dataset.lv);
          this.renderVip();
        });
      });
    }

    const meta = this.vipLevels.find((x) => x.level === this.selectedVipLevel);
    const detail = $("vip-level-detail");
    if (detail && meta) {
      const condNote =
        typeof meta.conditions?.note === "string" ? String(meta.conditions.note) : t("vipConditionsPending");
      detail.innerHTML = `
        <div class="vip-detail-card ${meta.unlocked ? "unlocked" : "locked"}">
          <h3>${langTitle(meta.title)} · ${meta.code}</h3>
          <p>${meta.unlocked ? t("vipUnlocked") : t("vipLocked")}</p>
          <p class="overlay-note">${condNote}</p>
        </div>`;
    }

    const chestBox = $("vip-chests");
    if (chestBox) {
      chestBox.innerHTML = this.chests
        .map((c) => {
          const title = langTitle(c.title) || c.kind;
          const state = c.claimed ? t("chestClaimed") : c.claimable ? t("chestClaim") : t("chestLocked");
          return `<button type="button" class="chest-btn${c.claimable ? " claimable" : ""}${c.claimed ? " claimed" : ""}" data-chest="${c.id}" ${c.claimable ? "" : "disabled"}>
            <span class="chest-icon" aria-hidden>▣</span>
            <span class="chest-title">${title}</span>
            <span class="chest-amt">${c.amountMinor} ${c.currency}</span>
            <span class="chest-state">${state}</span>
          </button>`;
        })
        .join("");
      chestBox.querySelectorAll<HTMLButtonElement>(".chest-btn.claimable").forEach((btn) => {
        btn.addEventListener("click", () => void this.claimChest(btn.dataset.chest ?? ""));
      });
    }
  }

  private async claimChest(rewardDefId: string): Promise<void> {
    if (!rewardDefId || this.game.busy) {
      this.toast(t("overlayWaitSpin"));
      return;
    }
    const chestEl = document.querySelector(`[data-chest="${rewardDefId}"]`);
    chestEl?.classList.add("chest-opening");
    try {
      const data = await api<{
        claim: { amountMinor: number; balanceAfterMinor: number; alreadyClaimed?: boolean };
      }>("/api/v1/game/vip/rewards/claim", {
        method: "POST",
        body: JSON.stringify({ rewardDefId }),
      });
      this.toast(
        data.claim.alreadyClaimed
          ? t("chestClaimed")
          : `${t("chestClaimed")} +${data.claim.amountMinor}`,
      );
      this.onBalanceRefresh?.();
      await this.loadVip();
      this.renderVip();
    } catch (cause) {
      this.toast(cause instanceof Error ? cause.message : t("errorGeneric"));
    } finally {
      chestEl?.classList.remove("chest-opening");
    }
  }

  /** Called from Hud.releasePointerTraps — hide only, never dispose GL. */
  hideAll(): void {
    for (const id of ["profile-modal", "vip-modal", "wallet-modal", "help-modal"]) {
      hide(id);
    }
  }
}
