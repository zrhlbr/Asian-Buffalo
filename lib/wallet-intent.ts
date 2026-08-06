/**
 * Wallet Intent state machine.
 *
 * NEW → LOCKED → PROCESSING → SUCCESS | FAILED | UNKNOWN → RECOVERED
 * Every status supports recovery entry points.
 */

export const WALLET_INTENT_STATUSES = [
  "NEW",
  "LOCKED",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "UNKNOWN",
  "RECOVERED",
] as const;

export type WalletIntentStatus = (typeof WALLET_INTENT_STATUSES)[number];

export type WalletIntentOperation = "DEBIT" | "CREDIT" | "SETTLE" | "ROLLBACK";

export type WalletIntent = {
  id: string;
  playerId: string;
  idempotencyKey: string;
  operation: WalletIntentOperation;
  status: WalletIntentStatus;
  currency: string;
  amountMinor: number;
  requestHash: string;
  providerOpId: string | null;
  ledgerTxId: string | null;
  resultJson: string | null;
  errorCode: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

const ALLOWED_TRANSITIONS: Record<WalletIntentStatus, readonly WalletIntentStatus[]> = {
  NEW: ["LOCKED", "FAILED"],
  LOCKED: ["PROCESSING", "FAILED", "UNKNOWN"],
  PROCESSING: ["SUCCESS", "FAILED", "UNKNOWN"],
  SUCCESS: ["RECOVERED"],
  FAILED: ["RECOVERED", "LOCKED"],
  UNKNOWN: ["RECOVERED", "PROCESSING", "SUCCESS", "FAILED"],
  RECOVERED: [],
};

export class IllegalIntentTransitionError extends Error {
  readonly failClosed = true as const;
  readonly from: WalletIntentStatus;
  readonly to: WalletIntentStatus;
  constructor(from: WalletIntentStatus, to: WalletIntentStatus) {
    super(`Illegal wallet intent transition ${from} → ${to}`);
    this.name = "IllegalIntentTransitionError";
    this.from = from;
    this.to = to;
  }
}

export class IntentCasError extends Error {
  readonly failClosed = true as const;
  constructor(message: string) {
    super(message);
    this.name = "IntentCasError";
  }
}

export function canTransitionIntent(
  from: WalletIntentStatus,
  to: WalletIntentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertIntentTransition(
  from: WalletIntentStatus,
  to: WalletIntentStatus,
): void {
  if (!canTransitionIntent(from, to)) {
    throw new IllegalIntentTransitionError(from, to);
  }
}

export type IntentStore = {
  getByIdempotency(playerId: string, idempotencyKey: string): Promise<WalletIntent | null>;
  getById(id: string): Promise<WalletIntent | null>;
  insert(intent: WalletIntent): Promise<WalletIntent>;
  transition(
    id: string,
    expectedVersion: number,
    to: WalletIntentStatus,
    patch?: Partial<
      Pick<
        WalletIntent,
        "providerOpId" | "ledgerTxId" | "resultJson" | "errorCode" | "updatedAt"
      >
    >,
  ): Promise<WalletIntent>;
  listByStatus(status: WalletIntentStatus): Promise<WalletIntent[]>;
};

export class MemoryIntentStore implements IntentStore {
  private byId = new Map<string, WalletIntent>();
  private byKey = new Map<string, string>();

  private key(playerId: string, idempotencyKey: string): string {
    return `${playerId}:${idempotencyKey}`;
  }

  async getByIdempotency(
    playerId: string,
    idempotencyKey: string,
  ): Promise<WalletIntent | null> {
    const id = this.byKey.get(this.key(playerId, idempotencyKey));
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async getById(id: string): Promise<WalletIntent | null> {
    return this.byId.get(id) ?? null;
  }

  async insert(intent: WalletIntent): Promise<WalletIntent> {
    const k = this.key(intent.playerId, intent.idempotencyKey);
    if (this.byKey.has(k)) {
      throw new IntentCasError(`Duplicate intent idempotency key ${k}`);
    }
    this.byId.set(intent.id, { ...intent });
    this.byKey.set(k, intent.id);
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
    const current = this.byId.get(id);
    if (!current) throw new IntentCasError(`Intent ${id} not found`);
    if (current.version !== expectedVersion) {
      throw new IntentCasError(
        `Intent CAS failed for ${id}: expected v${expectedVersion}, got v${current.version}`,
      );
    }
    assertIntentTransition(current.status, to);
    const next: WalletIntent = {
      ...current,
      ...patch,
      status: to,
      version: current.version + 1,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
    };
    this.byId.set(id, next);
    return { ...next };
  }

  async listByStatus(status: WalletIntentStatus): Promise<WalletIntent[]> {
    return [...this.byId.values()].filter((intent) => intent.status === status);
  }
}

export function createWalletIntent(input: {
  id: string;
  playerId: string;
  idempotencyKey: string;
  operation: WalletIntentOperation;
  currency: string;
  amountMinor: number;
  requestHash: string;
  now?: string;
}): WalletIntent {
  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id,
    playerId: input.playerId,
    idempotencyKey: input.idempotencyKey,
    operation: input.operation,
    status: "NEW",
    currency: input.currency,
    amountMinor: input.amountMinor,
    requestHash: input.requestHash,
    providerOpId: null,
    ledgerTxId: null,
    resultJson: null,
    errorCode: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}
