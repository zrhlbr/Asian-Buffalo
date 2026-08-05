import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

/** Independent player identity; never reuse a ZRH primary key. */
export const players = sqliteTable(
  "players",
  {
    id: text("id").primaryKey(),
    walletAdapterRef: text("wallet_adapter_ref").notNull(),
    currency: text("currency").notNull().default("MMK"),
    status: text("status", { enum: ["ACTIVE", "LOCKED", "CLOSED"] })
      .notNull()
      .default("ACTIVE"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("players_wallet_adapter_ref_unique").on(table.walletAdapterRef),
    check("players_currency_length", sql`length(${table.currency}) = 3`),
  ],
);

export const gameMathVersions = sqliteTable(
  "game_math_versions",
  {
    id: text("id").primaryKey(),
    sha256: text("sha256").notNull(),
    status: text("status", { enum: ["DRAFT", "FROZEN", "RETIRED"] })
      .notNull()
      .default("DRAFT"),
    configJson: text("config_json").notNull(),
    activatedAt: text("activated_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("game_math_versions_sha256_unique").on(table.sha256)],
);

export const gameSessions = sqliteTable(
  "game_sessions",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    mathVersionId: text("math_version_id")
      .notNull()
      .references(() => gameMathVersions.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["OPEN", "CLOSED", "REVOKED"] })
      .notNull()
      .default("OPEN"),
    freeGamesRemaining: integer("free_games_remaining").notNull().default(0),
    expiresAt: text("expires_at").notNull(),
    ...timestamps,
  },
  (table) => [
    index("game_sessions_player_status_idx").on(table.playerId, table.status),
    check("game_sessions_free_games_nonnegative", sql`${table.freeGamesRemaining} >= 0`),
  ],
);

export const gameRounds = sqliteTable(
  "game_rounds",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id, { onDelete: "restrict" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    mathVersionId: text("math_version_id")
      .notNull()
      .references(() => gameMathVersions.id, { onDelete: "restrict" }),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    requestPayload: text("request_payload"),
    resultHash: text("result_hash"),
    status: text("status", { enum: ["PENDING", "SETTLED", "VOID"] })
      .notNull()
      .default("PENDING"),
    currency: text("currency").notNull(),
    totalBetMinor: integer("total_bet_minor").notNull(),
    totalWinMinor: integer("total_win_minor"),
    balanceAfterMinor: integer("balance_after_minor"),
    isFreeGame: integer("is_free_game", { mode: "boolean" }).notNull().default(false),
    outcomeJson: text("outcome_json"),
    settledAt: text("settled_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("game_rounds_player_idempotency_unique").on(
      table.playerId,
      table.idempotencyKey,
    ),
    index("game_rounds_session_created_idx").on(table.sessionId, table.createdAt),
    check("game_rounds_bet_nonnegative", sql`${table.totalBetMinor} >= 0`),
    check(
      "game_rounds_win_nonnegative",
      sql`${table.totalWinMinor} IS NULL OR ${table.totalWinMinor} >= 0`,
    ),
  ],
);

export const ledgerAccounts = sqliteTable(
  "ledger_accounts",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id").references(() => players.id, { onDelete: "restrict" }),
    kind: text("kind", {
      enum: [
        "PLAYER_AVAILABLE",
        "PLAYER_HELD",
        "GAME_CLEARING",
        "DEPOSIT_TRANSIT",
        "WITHDRAWAL_TRANSIT",
        "FEES",
        "ADJUSTMENTS",
      ],
    }).notNull(),
    currency: text("currency").notNull(),
    balanceMinor: integer("balance_minor").notNull().default(0),
    version: integer("version").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ledger_accounts_owner_kind_currency_unique").on(
      table.playerId,
      table.kind,
      table.currency,
    ),
    index("ledger_accounts_player_idx").on(table.playerId),
  ],
);

export const ledgerTransactions = sqliteTable(
  "ledger_transactions",
  {
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    roundId: text("round_id").references(() => gameRounds.id, { onDelete: "restrict" }),
    kind: text("kind", {
      enum: ["GAME_BET", "GAME_PAYOUT", "DEPOSIT", "WITHDRAWAL", "ADJUSTMENT", "REVERSAL"],
    }).notNull(),
    status: text("status", { enum: ["PENDING", "POSTED", "REVERSED"] })
      .notNull()
      .default("PENDING"),
    requestHash: text("request_hash").notNull(),
    postedAt: text("posted_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("ledger_transactions_idempotency_unique").on(table.idempotencyKey),
    index("ledger_transactions_round_idx").on(table.roundId),
  ],
);

/** Signed amount: negative is debit from the account, positive is credit. */
export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => ledgerTransactions.id, { onDelete: "restrict" }),
    accountId: text("account_id")
      .notNull()
      .references(() => ledgerAccounts.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    balanceAfterMinor: integer("balance_after_minor").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("ledger_entries_transaction_sequence_unique").on(
      table.transactionId,
      table.sequence,
    ),
    index("ledger_entries_account_created_idx").on(table.accountId, table.createdAt),
    check("ledger_entries_amount_nonzero", sql`${table.amountMinor} <> 0`),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorType: text("actor_type", { enum: ["PLAYER", "SYSTEM", "ADMIN"] }).notNull(),
    actorId: text("actor_id").notNull(),
    eventType: text("event_type").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    eventJson: text("event_json").notNull(),
    previousHash: text("previous_hash"),
    eventHash: text("event_hash").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("audit_events_event_hash_unique").on(table.eventHash),
    index("audit_events_subject_created_idx").on(
      table.subjectType,
      table.subjectId,
      table.createdAt,
    ),
  ],
);
