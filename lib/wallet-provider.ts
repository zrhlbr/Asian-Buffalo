/**
 * Wallet Provider state machine (distinct from IdentityProvider).
 *
 * Happy path: NEW → PROCESSING → SUCCESS → SETTLED
 * Failure: FAILED | UNKNOWN → RECOVER
 * Must never double-debit for the same provider idempotency key.
 */

export const WALLET_PROVIDER_STATUSES = [
  "NEW",
  "PROCESSING",
  "SUCCESS",
  "SETTLED",
  "FAILED",
  "UNKNOWN",
  "RECOVER",
] as const;

export type WalletProviderStatus = (typeof WALLET_PROVIDER_STATUSES)[number];

export type WalletProviderOp = {
  id: string;
  intentId: string;
  idempotencyKey: string;
  status: WalletProviderStatus;
  currency: string;
  amountMinor: number;
  direction: "DEBIT" | "CREDIT";
  version: number;
  createdAt: string;
  updatedAt: string;
};

const ALLOWED: Record<WalletProviderStatus, readonly WalletProviderStatus[]> = {
  NEW: ["PROCESSING", "FAILED"],
  PROCESSING: ["SUCCESS", "FAILED", "UNKNOWN"],
  SUCCESS: ["SETTLED"],
  SETTLED: ["RECOVER"],
  FAILED: ["RECOVER"],
  UNKNOWN: ["RECOVER", "PROCESSING", "SUCCESS", "FAILED"],
  RECOVER: ["SETTLED", "FAILED"],
};

export class IllegalProviderTransitionError extends Error {
  readonly failClosed = true as const;
  readonly from: WalletProviderStatus;
  readonly to: WalletProviderStatus;
  constructor(from: WalletProviderStatus, to: WalletProviderStatus) {
    super(`Illegal wallet provider transition ${from} → ${to}`);
    this.name = "IllegalProviderTransitionError";
    this.from = from;
    this.to = to;
  }
}

export class ProviderCasError extends Error {
  readonly failClosed = true as const;
  constructor(message: string) {
    super(message);
    this.name = "ProviderCasError";
  }
}

export function assertProviderTransition(
  from: WalletProviderStatus,
  to: WalletProviderStatus,
): void {
  if (!ALLOWED[from].includes(to)) {
    throw new IllegalProviderTransitionError(from, to);
  }
}

export type ProviderStore = {
  getById(id: string): Promise<WalletProviderOp | null>;
  getByIdempotency(idempotencyKey: string): Promise<WalletProviderOp | null>;
  getByIntentId(intentId: string): Promise<WalletProviderOp | null>;
  insert(op: WalletProviderOp): Promise<WalletProviderOp>;
  transition(
    id: string,
    expectedVersion: number,
    to: WalletProviderStatus,
    updatedAt?: string,
  ): Promise<WalletProviderOp>;
  listByStatus(status: WalletProviderStatus): Promise<WalletProviderOp[]>;
};

export class MemoryProviderStore implements ProviderStore {
  private byId = new Map<string, WalletProviderOp>();
  private byKey = new Map<string, string>();
  private byIntent = new Map<string, string>();

  async getById(id: string): Promise<WalletProviderOp | null> {
    return this.byId.get(id) ?? null;
  }

  async getByIdempotency(idempotencyKey: string): Promise<WalletProviderOp | null> {
    const id = this.byKey.get(idempotencyKey);
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async getByIntentId(intentId: string): Promise<WalletProviderOp | null> {
    const id = this.byIntent.get(intentId);
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async insert(op: WalletProviderOp): Promise<WalletProviderOp> {
    if (this.byKey.has(op.idempotencyKey)) {
      throw new ProviderCasError(`Duplicate provider idempotency ${op.idempotencyKey}`);
    }
    if (this.byIntent.has(op.intentId)) {
      throw new ProviderCasError(`Provider op already exists for intent ${op.intentId}`);
    }
    this.byId.set(op.id, { ...op });
    this.byKey.set(op.idempotencyKey, op.id);
    this.byIntent.set(op.intentId, op.id);
    return { ...op };
  }

  async transition(
    id: string,
    expectedVersion: number,
    to: WalletProviderStatus,
    updatedAt?: string,
  ): Promise<WalletProviderOp> {
    const current = this.byId.get(id);
    if (!current) throw new ProviderCasError(`Provider op ${id} not found`);
    if (current.version !== expectedVersion) {
      throw new ProviderCasError(
        `Provider CAS failed for ${id}: expected v${expectedVersion}, got v${current.version}`,
      );
    }
    assertProviderTransition(current.status, to);
    const next: WalletProviderOp = {
      ...current,
      status: to,
      version: current.version + 1,
      updatedAt: updatedAt ?? new Date().toISOString(),
    };
    this.byId.set(id, next);
    return { ...next };
  }

  async listByStatus(status: WalletProviderStatus): Promise<WalletProviderOp[]> {
    return [...this.byId.values()].filter((op) => op.status === status);
  }
}

/** Local/test provider: completes synchronously without external I/O. */
export class LocalTestWalletProvider {
  private readonly store: ProviderStore;
  constructor(store: ProviderStore) {
    this.store = store;
  }

  async begin(input: {
    id: string;
    intentId: string;
    idempotencyKey: string;
    currency: string;
    amountMinor: number;
    direction: "DEBIT" | "CREDIT";
    now?: string;
  }): Promise<WalletProviderOp> {
    const existing = await this.store.getByIdempotency(input.idempotencyKey);
    if (existing) {
      if (
        existing.intentId !== input.intentId ||
        existing.amountMinor !== input.amountMinor ||
        existing.direction !== input.direction
      ) {
        throw new ProviderCasError("Provider idempotency conflict (replay protection)");
      }
      return existing;
    }
    const now = input.now ?? new Date().toISOString();
    return this.store.insert({
      id: input.id,
      intentId: input.intentId,
      idempotencyKey: input.idempotencyKey,
      status: "NEW",
      currency: input.currency,
      amountMinor: input.amountMinor,
      direction: input.direction,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  async settleLocal(opId: string): Promise<WalletProviderOp> {
    let op = await this.store.getById(opId);
    if (!op) throw new ProviderCasError(`Provider op ${opId} not found`);
    if (op.status === "SETTLED") return op;
    // Recovery: UNKNOWN may re-enter PROCESSING.
    if (op.status === "UNKNOWN") {
      op = await this.store.transition(op.id, op.version, "PROCESSING");
    }
    if (op.status === "RECOVER") {
      op = await this.store.transition(op.id, op.version, "SETTLED");
      return op;
    }
    if (op.status === "NEW") {
      op = await this.store.transition(op.id, op.version, "PROCESSING");
    }
    if (op.status === "PROCESSING") {
      op = await this.store.transition(op.id, op.version, "SUCCESS");
    }
    if (op.status === "SUCCESS") {
      op = await this.store.transition(op.id, op.version, "SETTLED");
    }
    if (op.status !== "SETTLED") {
      throw new ProviderCasError(`Cannot settle provider op in status ${op.status}`);
    }
    return op;
  }

  async markFailed(opId: string): Promise<WalletProviderOp> {
    const op = await this.store.getById(opId);
    if (!op) throw new ProviderCasError(`Provider op ${opId} not found`);
    if (op.status === "FAILED" || op.status === "SETTLED") return op;
    if (op.status === "NEW" || op.status === "PROCESSING") {
      return this.store.transition(op.id, op.version, "FAILED");
    }
    throw new ProviderCasError(`Cannot mark failed from ${op.status}`);
  }

  async markUnknown(opId: string): Promise<WalletProviderOp> {
    const op = await this.store.getById(opId);
    if (!op) throw new ProviderCasError(`Provider op ${opId} not found`);
    if (op.status === "UNKNOWN") return op;
    if (op.status === "PROCESSING") {
      return this.store.transition(op.id, op.version, "UNKNOWN");
    }
    throw new ProviderCasError(`Cannot mark unknown from ${op.status}`);
  }
}
