/**
 * Round store interface and an in-memory test implementation.
 *
 * The store guarantees idempotency at the round level: the same
 * (playerId, idempotencyKey) pair always returns the identical round result.
 */

import type { SpinResult } from "./round-service.ts";

export interface RoundStore {
  getByIdempotencyKey(playerId: string, idempotencyKey: string): Promise<SpinResult | undefined>;
  saveRound(result: SpinResult): Promise<void>;
}

export class TestRoundStore implements RoundStore {
  private rounds = new Map<string, SpinResult>();

  private key(playerId: string, idempotencyKey: string): string {
    return `${playerId}:${idempotencyKey}`;
  }

  async getByIdempotencyKey(
    playerId: string,
    idempotencyKey: string,
  ): Promise<SpinResult | undefined> {
    return this.rounds.get(this.key(playerId, idempotencyKey));
  }

  async saveRound(result: SpinResult): Promise<void> {
    this.rounds.set(this.key(result.playerId, result.idempotencyKey), result);
  }
}
