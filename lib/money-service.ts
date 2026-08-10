/**
 * Orchestrates Wallet Intent + Provider + Ledger for TEST mode.
 * Debit / Credit / Rollback / Retry / Timeout / Unknown — all idempotent.
 */

import { buildSpinPostings } from "./ledger.ts";
import {
  MemoryLedger,
  seedTestAvailable,
  wrapMemoryLedger,
  type LedgerPort,
} from "./db-ledger.ts";
import {
  createWalletIntent,
  MemoryIntentStore,
  type IntentStore,
  type WalletIntent,
} from "./wallet-intent.ts";
import { assertTestWalletAllowed, type WalletMode } from "./wallet-mode.ts";
import {
  LocalTestWalletProvider,
  MemoryProviderStore,
  type ProviderStore,
} from "./wallet-provider.ts";
import {
  DuplicateIdempotencyKeyError,
  InsufficientBalanceError,
  type RoundSettlement,
  WalletResultUnknownError,
} from "./wallet-adapter.ts";

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function hashRequest(parts: Record<string, unknown>): string {
  return JSON.stringify(parts);
}

export type MoneyOpResult = {
  intent: WalletIntent;
  settlement?: RoundSettlement;
  rolledBack?: boolean;
};

export class MoneyService {
  readonly ledger: LedgerPort;
  readonly intents: IntentStore;
  readonly providers: ProviderStore;
  readonly provider: LocalTestWalletProvider;
  readonly mode: WalletMode;

  /** Test hook: force unknown after provider PROCESSING. */
  forceUnknownAfterProcessing = false;
  /** Test hook: throw after ledger post to simulate crash. */
  crashAfterLedgerPost = false;

  constructor(options?: {
    mode?: WalletMode;
    ledger?: MemoryLedger | LedgerPort;
    intents?: IntentStore;
    providers?: ProviderStore;
  }) {
    this.mode = options?.mode ?? "TEST";
    const ledger = options?.ledger ?? new MemoryLedger();
    this.ledger =
      ledger instanceof MemoryLedger ? wrapMemoryLedger(ledger) : ledger;
    this.intents = options?.intents ?? new MemoryIntentStore();
    this.providers = options?.providers ?? new MemoryProviderStore();
    this.provider = new LocalTestWalletProvider(this.providers);
  }

  async seed(playerId: string, currency: string, amountMinor: number): Promise<void> {
    assertTestWalletAllowed(this.mode);
    await seedTestAvailable(this.ledger, playerId, currency, amountMinor);
  }

  async getAvailableBalance(playerId: string, currency: string): Promise<number> {
    const { available } = await this.ledger.ensurePlayerAccounts(playerId, currency);
    return this.ledger.getBalance(available.id);
  }

  async debit(input: {
    playerId: string;
    currency: string;
    amountMinor: number;
    idempotencyKey: string;
  }): Promise<MoneyOpResult> {
    return this.runMoneyMove({
      ...input,
      operation: "DEBIT",
      direction: "DEBIT",
      winMinor: 0,
      isFreeGame: false,
    });
  }

  async credit(input: {
    playerId: string;
    currency: string;
    amountMinor: number;
    idempotencyKey: string;
  }): Promise<MoneyOpResult> {
    return this.runMoneyMove({
      ...input,
      operation: "CREDIT",
      direction: "CREDIT",
      winMinor: input.amountMinor,
      betMinorOverride: 0,
      isFreeGame: true,
    });
  }

  async settleRound(input: {
    idempotencyKey: string;
    playerId: string;
    currency: string;
    betMinor: number;
    winMinor: number;
    isFreeGame: boolean;
    roundId?: string;
  }): Promise<RoundSettlement> {
    const result = await this.runMoneyMove({
      playerId: input.playerId,
      currency: input.currency,
      amountMinor: input.betMinor,
      idempotencyKey: input.idempotencyKey,
      operation: "SETTLE",
      direction: "DEBIT",
      winMinor: input.winMinor,
      betMinorOverride: input.betMinor,
      isFreeGame: input.isFreeGame,
      roundId: input.roundId,
    });
    if (!result.settlement) {
      throw new WalletResultUnknownError("Settle completed without settlement payload");
    }
    return result.settlement;
  }

  async rollback(input: {
    playerId: string;
    originalIdempotencyKey: string;
    rollbackIdempotencyKey: string;
  }): Promise<MoneyOpResult> {
    assertTestWalletAllowed(this.mode);
    const original = await this.intents.getByIdempotency(
      input.playerId,
      input.originalIdempotencyKey,
    );
    if (!original) {
      throw new InsufficientBalanceError("Original intent not found for rollback");
    }
    if (original.status !== "SUCCESS" && original.status !== "RECOVERED") {
      throw new WalletResultUnknownError(
        `Cannot rollback intent in status ${original.status}`,
      );
    }

    const existing = await this.intents.getByIdempotency(
      input.playerId,
      input.rollbackIdempotencyKey,
    );
    if (existing?.status === "SUCCESS" || existing?.status === "RECOVERED") {
      return { intent: existing, rolledBack: true };
    }

    const requestHash = hashRequest({
      op: "ROLLBACK",
      original: input.originalIdempotencyKey,
    });
    let intent =
      existing ??
      (await this.intents.insert(
        createWalletIntent({
          id: newId("wi"),
          playerId: input.playerId,
          idempotencyKey: input.rollbackIdempotencyKey,
          operation: "ROLLBACK",
          currency: original.currency,
          amountMinor: original.amountMinor,
          requestHash,
        }),
      ));

    intent = await this.intents.transition(intent.id, intent.version, "LOCKED");
    intent = await this.intents.transition(intent.id, intent.version, "PROCESSING");

    const reversal = await this.ledger.reverse(
      `ledger:${input.originalIdempotencyKey}`,
      `ledger:${input.rollbackIdempotencyKey}`,
    );
    intent = await this.intents.transition(intent.id, intent.version, "SUCCESS", {
      ledgerTxId: reversal.id,
      resultJson: JSON.stringify({ reversed: original.idempotencyKey }),
    });
    return { intent, rolledBack: true };
  }

  async retry(intentId: string): Promise<MoneyOpResult> {
    assertTestWalletAllowed(this.mode);
    let intent = await this.intents.getById(intentId);
    if (!intent) throw new WalletResultUnknownError("Intent not found");
    if (intent.status === "SUCCESS" || intent.status === "RECOVERED") {
      return { intent };
    }
    if (intent.status === "FAILED" || intent.status === "UNKNOWN") {
      // Re-enter processing path via allowed transitions.
      if (intent.status === "FAILED") {
        intent = await this.intents.transition(intent.id, intent.version, "LOCKED");
      } else {
        intent = await this.intents.transition(intent.id, intent.version, "PROCESSING");
      }
    }
    if (intent.operation === "SETTLE" || intent.operation === "DEBIT") {
      const parsed = intent.resultJson
        ? (JSON.parse(intent.resultJson) as {
            betMinor?: number;
            winMinor?: number;
            isFreeGame?: boolean;
          })
        : {};
      return this.runMoneyMove({
        playerId: intent.playerId,
        currency: intent.currency,
        amountMinor: intent.amountMinor,
        idempotencyKey: intent.idempotencyKey,
        operation: intent.operation === "DEBIT" ? "DEBIT" : "SETTLE",
        direction: "DEBIT",
        winMinor: parsed.winMinor ?? 0,
        betMinorOverride: parsed.betMinor ?? intent.amountMinor,
        isFreeGame: parsed.isFreeGame ?? false,
      });
    }
    if (intent.operation === "CREDIT") {
      return this.credit({
        playerId: intent.playerId,
        currency: intent.currency,
        amountMinor: intent.amountMinor,
        idempotencyKey: intent.idempotencyKey,
      });
    }
    throw new WalletResultUnknownError(`Retry unsupported for ${intent.operation}`);
  }

  async markTimeout(intentId: string): Promise<WalletIntent> {
    assertTestWalletAllowed(this.mode);
    const intent = await this.intents.getById(intentId);
    if (!intent) throw new WalletResultUnknownError("Intent not found");
    if (intent.status === "UNKNOWN") return intent;
    if (intent.status === "LOCKED" || intent.status === "PROCESSING") {
      return this.intents.transition(intent.id, intent.version, "UNKNOWN", {
        errorCode: "TIMEOUT",
      });
    }
    throw new WalletResultUnknownError(`Cannot timeout from ${intent.status}`);
  }

  async markUnknown(intentId: string): Promise<WalletIntent> {
    return this.markTimeout(intentId);
  }

  private async runMoneyMove(input: {
    playerId: string;
    currency: string;
    amountMinor: number;
    idempotencyKey: string;
    operation: "DEBIT" | "CREDIT" | "SETTLE";
    direction: "DEBIT" | "CREDIT";
    winMinor: number;
    isFreeGame: boolean;
    betMinorOverride?: number;
    roundId?: string;
  }): Promise<MoneyOpResult> {
    assertTestWalletAllowed(this.mode);

    const betMinor = input.betMinorOverride ?? (input.direction === "DEBIT" ? input.amountMinor : 0);
    const winMinor = input.winMinor;
    const requestHash = hashRequest({
      op: input.operation,
      betMinor,
      winMinor,
      isFreeGame: input.isFreeGame,
      currency: input.currency,
    });

    const existing = await this.intents.getByIdempotency(
      input.playerId,
      input.idempotencyKey,
    );
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new DuplicateIdempotencyKeyError(
          `Idempotency key ${input.idempotencyKey} was used with different parameters`,
        );
      }
      if (existing.status === "SUCCESS" || existing.status === "RECOVERED") {
        const settlement = existing.resultJson
          ? (JSON.parse(existing.resultJson) as RoundSettlement)
          : undefined;
        return { intent: existing, settlement };
      }
      if (existing.status === "UNKNOWN") {
        throw new WalletResultUnknownError(
          `Intent ${existing.id} is UNKNOWN; run recovery`,
        );
      }
    }

    let intent =
      existing ??
      (await this.intents.insert(
        createWalletIntent({
          id: newId("wi"),
          playerId: input.playerId,
          idempotencyKey: input.idempotencyKey,
          operation: input.operation,
          currency: input.currency,
          amountMinor: input.operation === "CREDIT" ? winMinor : betMinor,
          requestHash,
        }),
      ));

    if (intent.status === "NEW") {
      intent = await this.intents.transition(intent.id, intent.version, "LOCKED", {
        resultJson: JSON.stringify({ betMinor, winMinor, isFreeGame: input.isFreeGame }),
      });
    }

    const { available, clearing } = await this.ledger.ensurePlayerAccounts(
      input.playerId,
      input.currency,
    );

    if (betMinor > 0 && (await this.ledger.getBalance(available.id)) < betMinor) {
      intent = await this.intents.transition(intent.id, intent.version, "FAILED", {
        errorCode: "INSUFFICIENT_BALANCE",
      });
      throw new InsufficientBalanceError(
        `Player ${input.playerId} balance < bet ${betMinor}`,
      );
    }

    const providerOp = await this.provider.begin({
      id: intent.providerOpId ?? newId("wpo"),
      intentId: intent.id,
      idempotencyKey: `provider:${input.idempotencyKey}`,
      currency: input.currency,
      amountMinor: input.operation === "CREDIT" ? winMinor : betMinor,
      direction: input.direction,
    });

    if (intent.status === "LOCKED") {
      intent = await this.intents.transition(intent.id, intent.version, "PROCESSING", {
        providerOpId: providerOp.id,
      });
    }

    if (this.forceUnknownAfterProcessing) {
      let op = providerOp;
      if (op.status === "NEW") {
        op = await this.providers.transition(op.id, op.version, "PROCESSING");
      }
      await this.provider.markUnknown(op.id);
      intent = await this.intents.transition(intent.id, intent.version, "UNKNOWN", {
        errorCode: "PROVIDER_UNKNOWN",
        providerOpId: op.id,
      });
      throw new WalletResultUnknownError("Provider outcome unknown");
    }

    await this.provider.settleLocal(providerOp.id);

    const postings = buildSpinPostings({
      playerAvailableAccountId: available.id,
      gameClearingAccountId: clearing.id,
      currency: input.currency,
      betMinor,
      winMinor,
      isFreeGame: input.isFreeGame,
    });

    let ledgerTxId: string | null = null;
    if (postings.length > 0) {
      const tx = await this.ledger.post({
        idempotencyKey: `ledger:${input.idempotencyKey}`,
        kind: betMinor > 0 ? "GAME_BET" : "GAME_PAYOUT",
        requestHash,
        postings,
        roundId: input.roundId ?? null,
      });
      ledgerTxId = tx.id;
    }

    if (this.crashAfterLedgerPost) {
      intent = await this.intents.transition(intent.id, intent.version, "UNKNOWN", {
        ledgerTxId,
        providerOpId: providerOp.id,
        errorCode: "CRASH_AFTER_LEDGER",
      });
      throw new WalletResultUnknownError("Crashed after ledger post");
    }

    const settlement: RoundSettlement = {
      idempotencyKey: input.idempotencyKey,
      playerId: input.playerId,
      currency: input.currency,
      betMinor,
      winMinor,
      isFreeGame: input.isFreeGame,
      postedAt: new Date().toISOString(),
      playerBalanceAfterMinor: await this.ledger.getBalance(available.id),
      postings,
    };

    intent = await this.intents.transition(intent.id, intent.version, "SUCCESS", {
      ledgerTxId,
      providerOpId: providerOp.id,
      resultJson: JSON.stringify(settlement),
    });

    return { intent, settlement };
  }
}
