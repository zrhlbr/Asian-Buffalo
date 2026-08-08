/**
 * D1-backed Intent / Provider / Ledger stores for formal play routes.
 * Keeps MoneyService contracts; persists so Admin Wallet/Ledger RO matches spins.
 */

import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema.ts";
import {
  LedgerFailClosedError,
  type LedgerPort,
  type LedgerAccountView,
  type LedgerPostInput,
  type PostedLedgerTransaction,
} from "./db-ledger.ts";
import { assertBalancedPostings, type LedgerPosting } from "./ledger.ts";
import { ConcurrentModificationError } from "./wallet-adapter.ts";
import {
  assertIntentTransition,
  IntentCasError,
  type IntentStore,
  type WalletIntent,
  type WalletIntentStatus,
} from "./wallet-intent.ts";
import {
  assertProviderTransition,
  ProviderCasError,
  type ProviderStore,
  type WalletProviderOp,
  type WalletProviderStatus,
} from "./wallet-provider.ts";

type AdminDb = DrizzleD1Database<typeof schema>;

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function accountKey(playerId: string, kind: string, currency: string): string {
  return `${playerId}:${kind}:${currency}`;
}

function mapIntent(row: typeof schema.walletIntents.$inferSelect): WalletIntent {
  return {
    id: row.id,
    playerId: row.playerId,
    idempotencyKey: row.idempotencyKey,
    operation: row.operation,
    status: row.status,
    currency: row.currency,
    amountMinor: row.amountMinor,
    requestHash: row.requestHash,
    providerOpId: row.providerOpId,
    ledgerTxId: row.ledgerTxId,
    resultJson: row.resultJson,
    errorCode: row.errorCode,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapProvider(row: typeof schema.walletProviderOps.$inferSelect): WalletProviderOp {
  return {
    id: row.id,
    intentId: row.intentId,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    currency: row.currency,
    amountMinor: row.amountMinor,
    direction: row.direction,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class D1IntentStore implements IntentStore {
  private readonly db: AdminDb;
  constructor(db: AdminDb) {
    this.db = db;
  }

  async getByIdempotency(
    playerId: string,
    idempotencyKey: string,
  ): Promise<WalletIntent | null> {
    const row = await this.db.query.walletIntents.findFirst({
      where: and(
        eq(schema.walletIntents.playerId, playerId),
        eq(schema.walletIntents.idempotencyKey, idempotencyKey),
      ),
    });
    return row ? mapIntent(row) : null;
  }

  async getById(id: string): Promise<WalletIntent | null> {
    const row = await this.db.query.walletIntents.findFirst({
      where: eq(schema.walletIntents.id, id),
    });
    return row ? mapIntent(row) : null;
  }

  async insert(intent: WalletIntent): Promise<WalletIntent> {
    try {
      await this.db.insert(schema.walletIntents).values({
        id: intent.id,
        playerId: intent.playerId,
        idempotencyKey: intent.idempotencyKey,
        operation: intent.operation,
        status: intent.status,
        currency: intent.currency,
        amountMinor: intent.amountMinor,
        requestHash: intent.requestHash,
        providerOpId: intent.providerOpId,
        ledgerTxId: intent.ledgerTxId,
        resultJson: intent.resultJson,
        errorCode: intent.errorCode,
        version: intent.version,
        createdAt: intent.createdAt,
        updatedAt: intent.updatedAt,
      });
    } catch (cause) {
      throw new IntentCasError(
        `Duplicate intent idempotency key ${intent.playerId}:${intent.idempotencyKey}: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
    }
    return { ...intent };
  }

  async transition(
    id: string,
    expectedVersion: number,
    to: WalletIntentStatus,
    patch: Partial<
      Pick<
        WalletIntent,
        "providerOpId" | "ledgerTxId" | "resultJson" | "errorCode" | "updatedAt"
      >
    > = {},
  ): Promise<WalletIntent> {
    const current = await this.getById(id);
    if (!current) throw new IntentCasError(`Intent ${id} not found`);
    if (current.version !== expectedVersion) {
      throw new IntentCasError(
        `Intent CAS failed for ${id}: expected v${expectedVersion}, got v${current.version}`,
      );
    }
    assertIntentTransition(current.status, to);
    const updatedAt = patch.updatedAt ?? new Date().toISOString();
    const result = await this.db
      .update(schema.walletIntents)
      .set({
        status: to,
        version: current.version + 1,
        updatedAt,
        ...(patch.providerOpId !== undefined ? { providerOpId: patch.providerOpId } : {}),
        ...(patch.ledgerTxId !== undefined ? { ledgerTxId: patch.ledgerTxId } : {}),
        ...(patch.resultJson !== undefined ? { resultJson: patch.resultJson } : {}),
        ...(patch.errorCode !== undefined ? { errorCode: patch.errorCode } : {}),
      })
      .where(
        and(eq(schema.walletIntents.id, id), eq(schema.walletIntents.version, expectedVersion)),
      )
      .returning();
    if (result.length === 0) {
      throw new IntentCasError(`Intent CAS failed for ${id} on write`);
    }
    return mapIntent(result[0]!);
  }

  async listByStatus(status: WalletIntentStatus): Promise<WalletIntent[]> {
    const rows = await this.db.query.walletIntents.findMany({
      where: eq(schema.walletIntents.status, status),
    });
    return rows.map(mapIntent);
  }
}

export class D1ProviderStore implements ProviderStore {
  private readonly db: AdminDb;
  constructor(db: AdminDb) {
    this.db = db;
  }

  async getById(id: string): Promise<WalletProviderOp | null> {
    const row = await this.db.query.walletProviderOps.findFirst({
      where: eq(schema.walletProviderOps.id, id),
    });
    return row ? mapProvider(row) : null;
  }

  async getByIdempotency(idempotencyKey: string): Promise<WalletProviderOp | null> {
    const row = await this.db.query.walletProviderOps.findFirst({
      where: eq(schema.walletProviderOps.idempotencyKey, idempotencyKey),
    });
    return row ? mapProvider(row) : null;
  }

  async getByIntentId(intentId: string): Promise<WalletProviderOp | null> {
    const row = await this.db.query.walletProviderOps.findFirst({
      where: eq(schema.walletProviderOps.intentId, intentId),
    });
    return row ? mapProvider(row) : null;
  }

  async insert(op: WalletProviderOp): Promise<WalletProviderOp> {
    try {
      await this.db.insert(schema.walletProviderOps).values({
        id: op.id,
        intentId: op.intentId,
        idempotencyKey: op.idempotencyKey,
        status: op.status,
        currency: op.currency,
        amountMinor: op.amountMinor,
        direction: op.direction,
        version: op.version,
        createdAt: op.createdAt,
        updatedAt: op.updatedAt,
      });
    } catch (cause) {
      throw new ProviderCasError(
        `Duplicate provider op: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
    return { ...op };
  }

  async transition(
    id: string,
    expectedVersion: number,
    to: WalletProviderStatus,
    updatedAt?: string,
  ): Promise<WalletProviderOp> {
    const current = await this.getById(id);
    if (!current) throw new ProviderCasError(`Provider op ${id} not found`);
    if (current.version !== expectedVersion) {
      throw new ProviderCasError(
        `Provider CAS failed for ${id}: expected v${expectedVersion}, got v${current.version}`,
      );
    }
    assertProviderTransition(current.status, to);
    const nextUpdatedAt = updatedAt ?? new Date().toISOString();
    const result = await this.db
      .update(schema.walletProviderOps)
      .set({
        status: to,
        version: current.version + 1,
        updatedAt: nextUpdatedAt,
      })
      .where(
        and(
          eq(schema.walletProviderOps.id, id),
          eq(schema.walletProviderOps.version, expectedVersion),
        ),
      )
      .returning();
    if (result.length === 0) {
      throw new ProviderCasError(`Provider CAS failed for ${id} on write`);
    }
    return mapProvider(result[0]!);
  }

  async listByStatus(status: WalletProviderStatus): Promise<WalletProviderOp[]> {
    const rows = await this.db.query.walletProviderOps.findMany({
      where: eq(schema.walletProviderOps.status, status),
    });
    return rows.map(mapProvider);
  }
}

export class D1Ledger implements LedgerPort {
  private readonly db: AdminDb;
  constructor(db: AdminDb) {
    this.db = db;
  }

  private async getOrCreate(
    playerId: string,
    kind: "PLAYER_AVAILABLE" | "GAME_CLEARING",
    currency: string,
  ): Promise<LedgerAccountView> {
    const id = accountKey(playerId, kind, currency);
    const existing = await this.db.query.ledgerAccounts.findFirst({
      where: eq(schema.ledgerAccounts.id, id),
    });
    if (existing) {
      return {
        id: existing.id,
        playerId: existing.playerId,
        kind: existing.kind,
        currency: existing.currency,
        balanceMinor: existing.balanceMinor,
        version: existing.version,
      };
    }
    const now = new Date().toISOString();
    await this.db.insert(schema.ledgerAccounts).values({
      id,
      playerId,
      kind,
      currency,
      balanceMinor: 0,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    await this.db.insert(schema.ledgerBalances).values({
      accountId: id,
      balanceMinor: 0,
      version: 0,
      updatedAt: now,
    });
    return {
      id,
      playerId,
      kind,
      currency,
      balanceMinor: 0,
      version: 0,
    };
  }

  async ensurePlayerAccounts(
    playerId: string,
    currency: string,
  ): Promise<{ available: LedgerAccountView; clearing: LedgerAccountView }> {
    return {
      available: await this.getOrCreate(playerId, "PLAYER_AVAILABLE", currency),
      clearing: await this.getOrCreate(playerId, "GAME_CLEARING", currency),
    };
  }

  async getBalance(accountId: string): Promise<number> {
    const bal = await this.db.query.ledgerBalances.findFirst({
      where: eq(schema.ledgerBalances.accountId, accountId),
    });
    if (!bal) throw new LedgerFailClosedError(`Unknown balance for ${accountId}`);
    return bal.balanceMinor;
  }

  async forceCreditAvailableForTest(
    playerId: string,
    currency: string,
    amountMinor: number,
  ): Promise<void> {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new RangeError("credit amount must be a positive safe integer");
    }
    const available = await this.getOrCreate(playerId, "PLAYER_AVAILABLE", currency);
    const now = new Date().toISOString();
    const nextBalance = available.balanceMinor + amountMinor;
    const nextVersion = available.version + 1;
    const updated = await this.db
      .update(schema.ledgerAccounts)
      .set({
        balanceMinor: nextBalance,
        version: nextVersion,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.ledgerAccounts.id, available.id),
          eq(schema.ledgerAccounts.version, available.version),
        ),
      )
      .returning();
    if (updated.length === 0) {
      throw new ConcurrentModificationError("Ledger account modified concurrently during seed");
    }
    await this.db
      .insert(schema.ledgerBalances)
      .values({
        accountId: available.id,
        balanceMinor: nextBalance,
        version: nextVersion,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.ledgerBalances.accountId,
        set: {
          balanceMinor: nextBalance,
          version: nextVersion,
          updatedAt: now,
        },
      });
  }

  async post(input: LedgerPostInput): Promise<PostedLedgerTransaction> {
    const existing = await this.db.query.ledgerTransactions.findFirst({
      where: eq(schema.ledgerTransactions.idempotencyKey, input.idempotencyKey),
    });
    if (existing) {
      if (existing.requestHash !== input.requestHash) {
        throw new LedgerFailClosedError("Ledger idempotency conflict (replay protection)");
      }
      const entries = await this.db.query.ledgerEntries.findMany({
        where: eq(schema.ledgerEntries.transactionId, existing.id),
      });
      return {
        id: existing.id,
        idempotencyKey: existing.idempotencyKey,
        kind: existing.kind,
        status: existing.status === "REVERSED" ? "REVERSED" : "POSTED",
        requestHash: existing.requestHash,
        postedAt: existing.postedAt ?? existing.createdAt,
        postings: entries.map(
          (entry): LedgerPosting => ({
            accountId: entry.accountId,
            currency: entry.currency,
            amountMinor: entry.amountMinor,
            memo: entry.amountMinor < 0 ? "BET" : "PAYOUT",
          }),
        ),
        roundId: existing.roundId,
      };
    }

    if (input.postings.length === 0) {
      throw new LedgerFailClosedError("Cannot post empty ledger transaction");
    }
    assertBalancedPostings(input.postings);

    const accounts: LedgerAccountView[] = [];
    for (const posting of input.postings) {
      const account = await this.db.query.ledgerAccounts.findFirst({
        where: eq(schema.ledgerAccounts.id, posting.accountId),
      });
      if (!account) throw new LedgerFailClosedError(`Unknown account ${posting.accountId}`);
      if (account.currency !== posting.currency) {
        throw new LedgerFailClosedError("Posting currency mismatch");
      }
      accounts.push({
        id: account.id,
        playerId: account.playerId,
        kind: account.kind,
        currency: account.currency,
        balanceMinor: account.balanceMinor,
        version: account.version,
      });
    }

    const nextBalances = new Map<string, number>();
    for (let i = 0; i < input.postings.length; i += 1) {
      const posting = input.postings[i]!;
      const account = accounts[i]!;
      const prev = nextBalances.get(account.id) ?? account.balanceMinor;
      nextBalances.set(account.id, prev + posting.amountMinor);
    }
    for (const account of accounts) {
      const next = nextBalances.get(account.id)!;
      if (account.kind === "PLAYER_AVAILABLE" && next < 0) {
        throw new LedgerFailClosedError("PLAYER_AVAILABLE would become negative");
      }
    }

    const now = new Date().toISOString();
    const txId = newId("ltx");
    await this.db.insert(schema.ledgerTransactions).values({
      id: txId,
      idempotencyKey: input.idempotencyKey,
      roundId: input.roundId ?? null,
      kind: input.kind,
      status: "POSTED",
      requestHash: input.requestHash,
      postedAt: now,
      createdAt: now,
    });

    const touchedIds = [...new Set(accounts.map((a) => a.id))];
    for (const accountId of touchedIds) {
      const account = accounts.find((a) => a.id === accountId)!;
      const nextBalance = nextBalances.get(accountId)!;
      const nextVersion = account.version + 1;
      const updated = await this.db
        .update(schema.ledgerAccounts)
        .set({
          balanceMinor: nextBalance,
          version: nextVersion,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.ledgerAccounts.id, accountId),
            eq(schema.ledgerAccounts.version, account.version),
          ),
        )
        .returning();
      if (updated.length === 0) {
        throw new ConcurrentModificationError("Ledger account modified concurrently");
      }
      await this.db
        .insert(schema.ledgerBalances)
        .values({
          accountId,
          balanceMinor: nextBalance,
          version: nextVersion,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.ledgerBalances.accountId,
          set: {
            balanceMinor: nextBalance,
            version: nextVersion,
            updatedAt: now,
          },
        });
    }

    let sequence = 0;
    for (const posting of input.postings) {
      sequence += 1;
      const balanceAfter = nextBalances.get(posting.accountId)!;
      await this.db.insert(schema.ledgerEntries).values({
        id: newId("le"),
        transactionId: txId,
        accountId: posting.accountId,
        sequence,
        amountMinor: posting.amountMinor,
        currency: posting.currency,
        balanceAfterMinor: balanceAfter,
        createdAt: now,
      });
    }

    return {
      id: txId,
      idempotencyKey: input.idempotencyKey,
      kind: input.kind,
      status: "POSTED",
      requestHash: input.requestHash,
      postedAt: now,
      postings: input.postings,
      roundId: input.roundId ?? null,
    };
  }

  async reverse(
    originalIdempotencyKey: string,
    reversalIdempotencyKey: string,
  ): Promise<PostedLedgerTransaction> {
    const original = await this.db.query.ledgerTransactions.findFirst({
      where: eq(schema.ledgerTransactions.idempotencyKey, originalIdempotencyKey),
    });
    if (!original) throw new LedgerFailClosedError("Original ledger transaction not found");
    const existingReversal = await this.db.query.ledgerTransactions.findFirst({
      where: eq(schema.ledgerTransactions.idempotencyKey, reversalIdempotencyKey),
    });
    if (existingReversal) {
      const entries = await this.db.query.ledgerEntries.findMany({
        where: eq(schema.ledgerEntries.transactionId, existingReversal.id),
      });
      return {
        id: existingReversal.id,
        idempotencyKey: existingReversal.idempotencyKey,
        kind: existingReversal.kind,
        status: existingReversal.status === "REVERSED" ? "REVERSED" : "POSTED",
        requestHash: existingReversal.requestHash,
        postedAt: existingReversal.postedAt ?? existingReversal.createdAt,
        postings: entries.map((entry): LedgerPosting => ({
          accountId: entry.accountId,
          currency: entry.currency,
          amountMinor: entry.amountMinor,
          memo: entry.amountMinor < 0 ? "BET" : "PAYOUT",
        })),
        roundId: existingReversal.roundId,
      };
    }

    const entries = await this.db.query.ledgerEntries.findMany({
      where: eq(schema.ledgerEntries.transactionId, original.id),
    });
    const reversePostings = entries.map(
      (entry): LedgerPosting => ({
        accountId: entry.accountId,
        currency: entry.currency,
        amountMinor: -entry.amountMinor,
        memo: entry.amountMinor < 0 ? "PAYOUT" : "BET",
      }),
    );
    const reversal = await this.post({
      idempotencyKey: reversalIdempotencyKey,
      kind: "REVERSAL",
      requestHash: `rev:${original.requestHash}`,
      postings: reversePostings,
      roundId: original.roundId,
    });
    await this.db
      .update(schema.ledgerTransactions)
      .set({ status: "REVERSED" })
      .where(eq(schema.ledgerTransactions.id, original.id));
    return reversal;
  }
}

/** Repair helper: attach round_id on ledger tx when settle knows the round. */
export async function attachLedgerRoundId(
  db: AdminDb,
  ledgerTxId: string,
  roundId: string,
): Promise<void> {
  await db.run(sql`
    UPDATE ledger_transactions
    SET round_id = ${roundId}
    WHERE id = ${ledgerTxId} AND (round_id IS NULL OR round_id = '')
  `);
}
