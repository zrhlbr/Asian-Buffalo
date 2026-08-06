/**
 * Typed money recovery: Crash / Pending / Unknown / Timeout.
 * Advances Intent + Provider + Ledger to a consistent terminal state.
 */

import type { MoneyService } from "./money-service.ts";
import type { WalletIntent } from "./wallet-intent.ts";
import { assertTestWalletAllowed } from "./wallet-mode.ts";

export type RecoveryKind = "CRASH" | "PENDING" | "UNKNOWN" | "TIMEOUT";

export type RecoveryResult = {
  kind: RecoveryKind;
  intent: WalletIntent;
  action: "REPLAYED" | "MARKED_RECOVERED" | "RETRIED" | "NOOP";
};

export class WalletRecoveryService {
  private readonly money: MoneyService;
  constructor(money: MoneyService) {
    this.money = money;
  }

  async recoverIntent(intentId: string, kind: RecoveryKind): Promise<RecoveryResult> {
    assertTestWalletAllowed(this.money.mode);
    let intent = await this.money.intents.getById(intentId);
    if (!intent) {
      throw new Error(`Intent ${intentId} not found`);
    }

    if (intent.status === "RECOVERED") {
      return { kind, intent, action: "NOOP" };
    }

    if (intent.status === "SUCCESS") {
      intent = await this.money.intents.transition(intent.id, intent.version, "RECOVERED");
      return { kind, intent, action: "MARKED_RECOVERED" };
    }

    if (intent.status === "FAILED") {
      intent = await this.money.intents.transition(intent.id, intent.version, "RECOVERED");
      return { kind, intent, action: "MARKED_RECOVERED" };
    }

    // PENDING-like: NEW / LOCKED / PROCESSING
    if (
      intent.status === "NEW" ||
      intent.status === "LOCKED" ||
      intent.status === "PROCESSING"
    ) {
      if (kind === "TIMEOUT") {
        intent = await this.money.markTimeout(intent.id);
        return { kind, intent, action: "RETRIED" };
      }
      // Crash/pending: retry completion
      const result = await this.money.retry(intent.id);
      if (result.intent.status === "SUCCESS") {
        const recovered = await this.money.intents.transition(
          result.intent.id,
          result.intent.version,
          "RECOVERED",
        );
        return { kind, intent: recovered, action: "REPLAYED" };
      }
      return { kind, intent: result.intent, action: "RETRIED" };
    }

    // UNKNOWN
    if (intent.status === "UNKNOWN") {
      // If ledger already posted, finalize SUCCESS then RECOVERED (no double post — idempotent).
      const ledgerKey = `ledger:${intent.idempotencyKey}`;
      try {
        const result = await this.money.retry(intent.id);
        if (result.intent.status === "SUCCESS") {
          const recovered = await this.money.intents.transition(
            result.intent.id,
            result.intent.version,
            "RECOVERED",
          );
          return { kind, intent: recovered, action: "REPLAYED" };
        }
        return { kind, intent: result.intent, action: "RETRIED" };
      } catch {
        // Fail closed: keep UNKNOWN if retry cannot complete safely.
        void ledgerKey;
        intent = (await this.money.intents.getById(intentId))!;
        return { kind, intent, action: "NOOP" };
      }
    }

    return { kind, intent, action: "NOOP" };
  }

  async recoverAllUnknown(): Promise<RecoveryResult[]> {
    const unknown = await this.money.intents.listByStatus("UNKNOWN");
    const results: RecoveryResult[] = [];
    for (const intent of unknown) {
      results.push(await this.recoverIntent(intent.id, "UNKNOWN"));
    }
    return results;
  }
}
