/**
 * FormalGameProvider — Session / Spin / Round / Rules client.
 * Server-authoritative; no client RNG, local paytable eval, or demo balance.
 */

import type {
  GameProvider,
  PresentationSpinResult,
  SpinRequest,
  SymbolId,
} from "./adapter.ts";

type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

type SessionResponse = {
  sessionId: string;
  mathVersionId: string;
  expiresAt: string;
};

type BalanceResponse = {
  balanceMinor: number;
  currency: string;
  playerId: string;
};

type ServerSpinResult = {
  roundId: string;
  sessionId: string;
  playerId: string;
  mathVersion: string;
  totalBetMinor: number;
  totalWinMinor: number;
  balanceAfterMinor: number;
  isFreeGame: boolean;
  freeGamesRemaining: number;
  awardedFreeGames: number;
  grid: string[][];
  winningPositions: { reel: number; row: number }[];
  lineWins: { line: number; symbol: string; count: number; payout: number }[];
  scatterCount: number;
  scatterWin: number;
  multiplier: number;
  settledAt: string;
};

const LAST_ROUND_KEY = "ab.m5.lastRoundId";
const SESSION_KEY = "ab.m5.sessionId";

function asSymbolGrid(grid: string[][]): SymbolId[][] {
  return grid.map((col) => col.map((cell) => cell as SymbolId));
}

function mapSpin(result: ServerSpinResult): PresentationSpinResult {
  return {
    roundId: result.roundId,
    grid: asSymbolGrid(result.grid),
    winMinor: result.totalWinMinor,
    totalBetMinor: result.totalBetMinor,
    balanceAfterMinor: result.balanceAfterMinor,
    lineWins: result.lineWins,
    winningPositions: result.winningPositions,
    scatterCount: result.scatterCount,
    scatterWin: result.scatterWin,
    freeGamesRemaining: result.freeGamesRemaining,
    awardedFreeGames: result.awardedFreeGames,
    isFreeGame: result.isFreeGame,
    mathVersion: result.mathVersion,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & ApiErrorBody;
  if (!response.ok) {
    const code = body.error?.code ?? `HTTP_${response.status}`;
    const message = body.error?.message ?? response.statusText;
    const err = new Error(`${code}: ${message}`);
    (err as Error & { code?: string }).code = code;
    throw err;
  }
  return body;
}

export class FormalGameProvider implements GameProvider {
  private sessionId: string | null = null;
  private mathVersionId: string | null = null;
  private balanceMinor = 0;
  private freeGamesRemaining = 0;
  private ready = false;

  getBalance(): number {
    return this.balanceMinor;
  }

  getFreeGamesRemaining(): number {
    return this.freeGamesRemaining;
  }

  getMathVersionId(): string | null {
    return this.mathVersionId;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  canBet(totalBetMinor: number): boolean {
    if (this.freeGamesRemaining > 0) return true;
    return totalBetMinor > 0 && this.balanceMinor >= totalBetMinor;
  }

  async ensureReady(): Promise<void> {
    if (this.ready && this.sessionId) return;

    const sessionRes = await fetch("/api/v1/game/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const session = await readJson<SessionResponse>(sessionRes);
    this.sessionId = session.sessionId;
    this.mathVersionId = session.mathVersionId;
    try {
      sessionStorage.setItem(SESSION_KEY, session.sessionId);
    } catch {
      /* ignore */
    }

    // Rules fetch validates ExecutableMathVersion is reachable (display/help).
    if (this.mathVersionId) {
      const rulesRes = await fetch(
        `/api/v1/game/rules/${encodeURIComponent(this.mathVersionId)}`,
      );
      await readJson<unknown>(rulesRes);
    }

    const balRes = await fetch("/api/v1/game/wallet/balance");
    const bal = await readJson<BalanceResponse>(balRes);
    this.balanceMinor = bal.balanceMinor;
    this.ready = true;
  }

  async spin(req: SpinRequest): Promise<PresentationSpinResult> {
    await this.ensureReady();
    if (!this.sessionId) throw new Error("SESSION_MISSING");

    const idempotencyKey = `spin_${crypto.randomUUID().replace(/-/g, "")}`;
    const response = await fetch("/api/v1/game/spins", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: this.sessionId,
        roomBase: req.roomBase,
        betLevel: req.betLevel,
        betMultiplier: req.betMultiplier,
        idempotencyKey,
      }),
    });
    const result = await readJson<ServerSpinResult>(response);
    const mapped = mapSpin(result);
    this.balanceMinor = mapped.balanceAfterMinor;
    this.freeGamesRemaining = mapped.freeGamesRemaining;
    try {
      sessionStorage.setItem(LAST_ROUND_KEY, mapped.roundId);
    } catch {
      /* ignore */
    }
    return mapped;
  }

  async recoverLastRound(): Promise<PresentationSpinResult | null> {
    let roundId: string | null = null;
    try {
      roundId = sessionStorage.getItem(LAST_ROUND_KEY);
    } catch {
      roundId = null;
    }
    if (!roundId) return null;

    const response = await fetch(
      `/api/v1/game/rounds/${encodeURIComponent(roundId)}`,
    );
    if (response.status === 404) return null;
    const result = await readJson<ServerSpinResult>(response);
    const mapped = mapSpin(result);
    this.balanceMinor = mapped.balanceAfterMinor;
    this.freeGamesRemaining = mapped.freeGamesRemaining;
    return mapped;
  }
}
