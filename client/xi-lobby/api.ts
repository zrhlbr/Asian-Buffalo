/** Fail-closed fetch helpers for XI GAME lobby. */

export type LoadState<T> =
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; code: string; message: string };

const PROFILE_CACHE_KEY = "xi-lobby-profile-cache-v1";
const BALANCE_CACHE_KEY = "xi-lobby-balance-cache-v1";
const CACHE_TTL_MS = 60_000;

function readSessionCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts?: number; data?: T };
    if (!parsed?.data || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    /* quota / private mode */
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchLobbyCatalog(): Promise<LoadState<Record<string, unknown>>> {
  try {
    const res = await fetch("/api/v1/lobby/catalog", { credentials: "same-origin" });
    const body = (await readJson(res)) as Record<string, unknown> | null;
    if (!res.ok || !body) {
      return {
        status: "error",
        code: "CATALOG_UNAVAILABLE",
        message: "catalog unavailable",
      };
    }
    return { status: "ok", data: body };
  } catch {
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}

export type LobbyProfileView = {
  nickname: string;
  vipLevel: number | null;
  avatarUrl: string | null;
  playerId: string | null;
};

/** Cached shell paint — never invents profile fields. */
export function peekCachedProfile(): LobbyProfileView | null {
  return readSessionCache<LobbyProfileView>(PROFILE_CACHE_KEY);
}

export async function fetchProfile(): Promise<LoadState<LobbyProfileView>> {
  try {
    const res = await fetch("/api/v1/game/profile", { credentials: "same-origin" });
    const body = (await readJson(res)) as {
      profile?: {
        nickname?: string;
        vipLevel?: number;
        avatarUrl?: string | null;
        playerId?: string;
      };
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok || !body?.profile) {
      const cached = peekCachedProfile();
      if (cached) return { status: "ok", data: cached };
      return {
        status: "error",
        code: body?.error?.code ?? "PROFILE_UNAVAILABLE",
        message: body?.error?.message ?? "profile unavailable",
      };
    }
    const data: LobbyProfileView = {
      nickname: body.profile.nickname ?? "",
      vipLevel:
        typeof body.profile.vipLevel === "number" ? body.profile.vipLevel : null,
      avatarUrl: body.profile.avatarUrl ?? null,
      playerId: typeof body.profile.playerId === "string" ? body.profile.playerId : null,
    };
    writeSessionCache(PROFILE_CACHE_KEY, data);
    return { status: "ok", data };
  } catch {
    const cached = peekCachedProfile();
    if (cached) return { status: "ok", data: cached };
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}

export type LobbyBalanceView = { currency: string; balanceMinor: number };

/** Cached shell paint — never invents balances. */
export function peekCachedBalance(): LobbyBalanceView | null {
  return readSessionCache<LobbyBalanceView>(BALANCE_CACHE_KEY);
}

/** Clear lobby profile/balance caches (logout / password reset). */
export function clearLobbyCaches(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PROFILE_CACHE_KEY);
    window.sessionStorage.removeItem(BALANCE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Apply Auth login/register snapshot into lobby caches without full reload.
 * Never invents balance — caller must pass server-returned wallet.
 */
export function applyAuthSnapshot(
  profile: LobbyProfileView,
  wallet: LobbyBalanceView,
): void {
  writeSessionCache(PROFILE_CACHE_KEY, profile);
  writeSessionCache(BALANCE_CACHE_KEY, wallet);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("xi-auth-hydrated", { detail: { profile, wallet } }),
    );
  }
}

export async function fetchBalance(): Promise<LoadState<LobbyBalanceView>> {
  try {
    const res = await fetch("/api/v1/game/wallet/balance", { credentials: "same-origin" });
    const body = (await readJson(res)) as {
      currency?: string;
      balanceMinor?: number;
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok || typeof body?.balanceMinor !== "number" || !body.currency) {
      const cached = peekCachedBalance();
      if (cached) return { status: "ok", data: cached };
      return {
        status: "error",
        code: body?.error?.code ?? "BALANCE_UNAVAILABLE",
        message: body?.error?.message ?? "balance unavailable",
      };
    }
    const data: LobbyBalanceView = {
      currency: body.currency,
      balanceMinor: body.balanceMinor,
    };
    writeSessionCache(BALANCE_CACHE_KEY, data);
    return { status: "ok", data };
  } catch {
    const cached = peekCachedBalance();
    if (cached) return { status: "ok", data: cached };
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}

export async function fetchAnnouncements(
  lang: "zh-CN" | "en" | "my-MM" = "zh-CN",
): Promise<LoadState<Array<{ id: string; title: string; body: string }>>> {
  try {
    const res = await fetch("/api/v1/game/announcements", { credentials: "same-origin" });
    const body = (await readJson(res)) as {
      items?: Array<{
        id?: string;
        title?: string;
        locales?: { zh?: string; en?: string; my?: string };
      }>;
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok || !body?.items) {
      return {
        status: "error",
        code: body?.error?.code ?? "ANNOUNCEMENTS_UNAVAILABLE",
        message: body?.error?.message ?? "announcements unavailable",
      };
    }
    const localeKey = lang === "my-MM" ? "my" : lang === "en" ? "en" : "zh";
    return {
      status: "ok",
      data: body.items.map((item, index) => {
        const localized = item.locales?.[localeKey] || item.locales?.zh || "";
        return {
          id: item.id ?? `ann-${index}`,
          title: item.title ?? "",
          body: localized,
        };
      }),
    };
  } catch {
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}

/** Read-only VIP probe for hub shell — never mutates balance. */
export async function fetchVip(): Promise<
  LoadState<{ level: number | null; status: string | null }>
> {
  try {
    const res = await fetch("/api/v1/game/vip", { credentials: "same-origin" });
    const body = (await readJson(res)) as {
      vip?: { level?: number; status?: string };
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok || !body?.vip) {
      return {
        status: "error",
        code: body?.error?.code ?? "VIP_UNAVAILABLE",
        message: body?.error?.message ?? "vip unavailable",
      };
    }
    return {
      status: "ok",
      data: {
        level: typeof body.vip.level === "number" ? body.vip.level : null,
        status: typeof body.vip.status === "string" ? body.vip.status : null,
      },
    };
  } catch {
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}

/** Match slot HUD: display ledger minor units as integer meter (no /100). */
export function formatMinor(balanceMinor: number, _currency: string): string {
  void _currency;
  try {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
    }).format(balanceMinor);
  } catch {
    return String(balanceMinor);
  }
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; code: string; message: string }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await readJson(res)) as Record<string, unknown> | null;
    if (!res.ok || !data) {
      const err = data?.error as { code?: string; message?: string } | undefined;
      return {
        ok: false,
        code: err?.code ?? "REQUEST_FAILED",
        message: err?.message ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, code: "NETWORK", message: "network error" };
  }
}

export async function fetchWalletSnapshot(): Promise<
  LoadState<{
    availableMinor: number;
    frozenMinor: number;
    currency: string;
    status: string;
    usdtSupported: boolean;
    recentMoves: Array<{
      id: string;
      kind: string;
      status: string;
      amountMinor: number;
      label: string;
      createdAt: string;
    }>;
  }>
> {
  try {
    const res = await fetch("/api/v1/game/wallet", { credentials: "same-origin" });
    const body = (await readJson(res)) as {
      wallet?: {
        availableMinor?: number;
        frozenMinor?: number;
        currency?: string;
        status?: string;
        usdtSupported?: boolean;
        recentMoves?: Array<{
          id: string;
          kind: string;
          status: string;
          amountMinor: number;
          label: string;
          createdAt: string;
        }>;
      };
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok || !body?.wallet || typeof body.wallet.availableMinor !== "number") {
      return {
        status: "error",
        code: body?.error?.code ?? "WALLET_UNAVAILABLE",
        message: body?.error?.message ?? "wallet unavailable",
      };
    }
    return {
      status: "ok",
      data: {
        availableMinor: body.wallet.availableMinor,
        frozenMinor: body.wallet.frozenMinor ?? 0,
        currency: body.wallet.currency ?? "MMK",
        status: body.wallet.status ?? "ACTIVE",
        usdtSupported: Boolean(body.wallet.usdtSupported),
        recentMoves: body.wallet.recentMoves ?? [],
      },
    };
  } catch {
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}

export type CommerceReadinessView = {
  productionReady: boolean;
  code: string;
  reason: string;
  testHarnessAllowed: boolean;
};

export async function fetchDepositChannels(): Promise<
  LoadState<{
    presetsMinor: number[];
    channels: Array<{ code: string; title: Record<string, string>; currency: string }>;
    readiness: CommerceReadinessView;
  }>
> {
  try {
    const res = await fetch("/api/v1/game/deposit/channels", { credentials: "same-origin" });
    const body = (await readJson(res)) as {
      config?: { presetsMinor?: number[] };
      channels?: Array<{ code: string; title: Record<string, string>; currency: string }>;
      readiness?: {
        productionReady?: boolean;
        code?: string;
        reason?: string;
        testHarnessAllowed?: boolean;
      };
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok || !body?.channels) {
      return {
        status: "error",
        code: body?.error?.code ?? "CHANNELS_UNAVAILABLE",
        message: body?.error?.message ?? "channels unavailable",
      };
    }
    return {
      status: "ok",
      data: {
        presetsMinor: body.config?.presetsMinor ?? [],
        channels: body.channels,
        readiness: {
          productionReady: body.readiness?.productionReady === true,
          code: body.readiness?.code ?? "NOT_PRODUCTION_READY",
          reason: body.readiness?.reason ?? "BR-005/007 unset",
          testHarnessAllowed: body.readiness?.testHarnessAllowed === true,
        },
      },
    };
  } catch {
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}

export async function createDeposit(input: {
  channelCode: string;
  amountMinor: number;
  idempotencyKey: string;
}): Promise<{ ok: true; orderId: string } | { ok: false; code: string; message: string }> {
  const result = await postJson("/api/v1/game/deposit", input);
  if (!result.ok) return result;
  const order = result.data.order as { id?: string } | undefined;
  if (!order?.id) return { ok: false, code: "BAD_RESPONSE", message: "missing order" };
  return { ok: true, orderId: order.id };
}

export async function confirmDepositTest(
  orderId: string,
): Promise<{ ok: true; balanceAfterMinor: number } | { ok: false; code: string; message: string }> {
  const result = await postJson("/api/v1/game/deposit/confirm", { orderId });
  if (!result.ok) return result;
  return {
    ok: true,
    balanceAfterMinor: Number(result.data.balanceAfterMinor ?? 0),
  };
}

export async function createWithdraw(input: {
  channelCode: string;
  account: string;
  amountMinor: number;
  idempotencyKey: string;
}): Promise<{ ok: true; requestId: string } | { ok: false; code: string; message: string }> {
  const result = await postJson("/api/v1/game/withdraw", input);
  if (!result.ok) return result;
  const req = result.data.request as { id?: string } | undefined;
  if (!req?.id) return { ok: false, code: "BAD_RESPONSE", message: "missing request" };
  return { ok: true, requestId: req.id };
}

export async function fetchWithdrawMeta(): Promise<
  LoadState<{
    minMinor: number;
    maxMinor: number;
    feeMinor: number;
    channels: Array<{ code: string; title: Record<string, string> }>;
    readiness: CommerceReadinessView;
  }>
> {
  try {
    const res = await fetch("/api/v1/game/withdraw", { credentials: "same-origin" });
    const body = (await readJson(res)) as {
      config?: { minMinor?: number; maxMinor?: number; feeMinor?: number };
      channels?: Array<{ code: string; title: Record<string, string> }>;
      readiness?: {
        productionReady?: boolean;
        code?: string;
        reason?: string;
        testHarnessAllowed?: boolean;
      };
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok || !body?.config || !body.channels) {
      return {
        status: "error",
        code: body?.error?.code ?? "WITHDRAW_UNAVAILABLE",
        message: body?.error?.message ?? "withdraw unavailable",
      };
    }
    return {
      status: "ok",
      data: {
        minMinor: Number(body.config.minMinor ?? 0),
        maxMinor: Number(body.config.maxMinor ?? 0),
        feeMinor: Number(body.config.feeMinor ?? 0),
        channels: body.channels,
        readiness: {
          productionReady: body.readiness?.productionReady === true,
          code: body.readiness?.code ?? "NOT_PRODUCTION_READY",
          reason: body.readiness?.reason ?? "BR-006/007 unset",
          testHarnessAllowed: body.readiness?.testHarnessAllowed === true,
        },
      },
    };
  } catch {
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}

export async function fetchActivities(): Promise<
  LoadState<
    Array<{
      id: string;
      code: string;
      title: Record<string, string>;
      rewardMinor: number;
      joinable: boolean;
      claimed: boolean;
      lockedReason: string | null;
    }>
  >
> {
  try {
    const res = await fetch("/api/v1/game/activities", { credentials: "same-origin" });
    const body = (await readJson(res)) as {
      items?: Array<{
        id: string;
        code: string;
        title: Record<string, string>;
        rewardMinor: number;
        joinable: boolean;
        claimed: boolean;
        lockedReason: string | null;
      }>;
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok || !body?.items) {
      return {
        status: "error",
        code: body?.error?.code ?? "ACTIVITIES_UNAVAILABLE",
        message: body?.error?.message ?? "activities unavailable",
      };
    }
    return { status: "ok", data: body.items };
  } catch {
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}

export async function claimActivity(
  activityId: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const result = await postJson("/api/v1/game/activities", { activityId });
  return result.ok ? { ok: true } : result;
}

export async function fetchCheckin(): Promise<
  LoadState<{ claimable: boolean; claimed: boolean; rewardMinor: number; dayKey: string }>
> {
  try {
    const res = await fetch("/api/v1/game/checkin", { credentials: "same-origin" });
    const body = (await readJson(res)) as {
      checkin?: {
        claimable?: boolean;
        claimed?: boolean;
        rewardMinor?: number;
        dayKey?: string;
      };
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok || !body?.checkin) {
      return {
        status: "error",
        code: body?.error?.code ?? "CHECKIN_UNAVAILABLE",
        message: body?.error?.message ?? "checkin unavailable",
      };
    }
    return {
      status: "ok",
      data: {
        claimable: Boolean(body.checkin.claimable),
        claimed: Boolean(body.checkin.claimed),
        rewardMinor: Number(body.checkin.rewardMinor ?? 0),
        dayKey: String(body.checkin.dayKey ?? ""),
      },
    };
  } catch {
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}

export async function claimCheckin(): Promise<
  { ok: true } | { ok: false; code: string; message: string }
> {
  const result = await postJson("/api/v1/game/checkin", {});
  return result.ok ? { ok: true } : result;
}

export type RankingRange = "today" | "7d" | "30d";

export type RankingRow = {
  rank: number;
  playerIdMasked: string;
  nicknameMasked: string;
  winAmountMinor: number;
  currency: string;
  game: string;
  range: RankingRange;
};

export async function fetchRankings(
  range: RankingRange = "7d",
): Promise<LoadState<{ range: RankingRange; items: RankingRow[]; total: number }>> {
  try {
    const res = await fetch(
      `/api/v1/game/rankings?range=${encodeURIComponent(range)}&limit=20`,
      { credentials: "same-origin" },
    );
    const body = (await readJson(res)) as {
      range?: RankingRange;
      total?: number;
      items?: RankingRow[];
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok || !body?.items) {
      return {
        status: "error",
        code: body?.error?.code ?? "RANKINGS_UNAVAILABLE",
        message: body?.error?.message ?? "rankings unavailable",
      };
    }
    return {
      status: "ok",
      data: {
        range: body.range ?? range,
        total: Number(body.total ?? body.items.length),
        items: body.items,
      },
    };
  } catch {
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}

export async function fetchWins(): Promise<
  LoadState<Array<{ roundId: string; betMinor: number; winMinor: number; createdAt: string }>>
> {
  try {
    const res = await fetch("/api/v1/game/wins?limit=20", { credentials: "same-origin" });
    const body = (await readJson(res)) as {
      items?: Array<{
        roundId: string;
        betMinor: number;
        winMinor: number;
        createdAt: string;
      }>;
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok || !body?.items) {
      return {
        status: "error",
        code: body?.error?.code ?? "WINS_UNAVAILABLE",
        message: body?.error?.message ?? "wins unavailable",
      };
    }
    return { status: "ok", data: body.items };
  } catch {
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}

export async function fetchVipLevels(): Promise<
  LoadState<{ level: number; status: string; levels: Array<{ level: number; code: string; title: Record<string, string> }> }>
> {
  try {
    const res = await fetch("/api/v1/game/vip/levels", { credentials: "same-origin" });
    const body = (await readJson(res)) as {
      vip?: {
        level?: number;
        status?: string;
        levels?: Array<{ level: number; code: string; title: Record<string, string> }>;
      };
      levels?: Array<{ level: number; code: string; title: Record<string, string> }>;
      error?: { code?: string; message?: string };
    } | null;
    if (!res.ok || !body?.vip) {
      return {
        status: "error",
        code: body?.error?.code ?? "VIP_UNAVAILABLE",
        message: body?.error?.message ?? "vip unavailable",
      };
    }
    return {
      status: "ok",
      data: {
        level: Number(body.vip.level ?? 0),
        status: String(body.vip.status ?? "PENDING"),
        levels: body.levels ?? body.vip.levels ?? [],
      },
    };
  } catch {
    return { status: "error", code: "NETWORK", message: "network error" };
  }
}
