/**
 * Additive wallet commerce sidecars: deposit / withdrawal / activity / check-in / config.
 * CREATE TABLE IF NOT EXISTS only — never alters core players/wallet/ledger tables.
 * Amounts/fees/channels are admin-configurable placeholders (see BUSINESS_RULES_PENDING).
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";

export const WALLET_COMMERCE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "payment_channels" (
  "code" text PRIMARY KEY NOT NULL,
  "title_json" text NOT NULL,
  "currency" text NOT NULL DEFAULT 'MMK',
  "enabled" integer NOT NULL DEFAULT 1,
  "sort_order" integer NOT NULL DEFAULT 0,
  "config_json" text NOT NULL DEFAULT '{}',
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "wallet_commerce_config" (
  "key" text PRIMARY KEY NOT NULL,
  "value_json" text NOT NULL,
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "deposit_orders" (
  "id" text PRIMARY KEY NOT NULL,
  "player_id" text NOT NULL,
  "currency" text NOT NULL,
  "channel_code" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'CREATED',
  "provider_ref" text,
  "idempotency_key" text NOT NULL,
  "ledger_intent_key" text,
  "fail_reason" text,
  "expires_at" text,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "deposit_orders_idempotency_unique"
  ON "deposit_orders" ("idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "deposit_orders_provider_ref_unique"
  ON "deposit_orders" ("provider_ref");
CREATE INDEX IF NOT EXISTS "deposit_orders_player_idx"
  ON "deposit_orders" ("player_id", "created_at");
CREATE INDEX IF NOT EXISTS "deposit_orders_status_idx"
  ON "deposit_orders" ("status", "created_at");
CREATE TABLE IF NOT EXISTS "withdrawal_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "player_id" text NOT NULL,
  "currency" text NOT NULL,
  "channel_code" text NOT NULL,
  "account_masked" text NOT NULL,
  "account_cipher" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "fee_minor" integer NOT NULL DEFAULT 0,
  "expected_minor" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "risk_flag" text,
  "review_required" integer NOT NULL DEFAULT 1,
  "idempotency_key" text NOT NULL,
  "hold_intent_key" text,
  "ledger_intent_key" text,
  "fail_reason" text,
  "reviewed_by" text,
  "reviewed_at" text,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawal_requests_idempotency_unique"
  ON "withdrawal_requests" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "withdrawal_requests_player_idx"
  ON "withdrawal_requests" ("player_id", "created_at");
CREATE INDEX IF NOT EXISTS "withdrawal_requests_status_idx"
  ON "withdrawal_requests" ("status", "created_at");
CREATE TABLE IF NOT EXISTS "player_activities" (
  "id" text PRIMARY KEY NOT NULL,
  "code" text NOT NULL UNIQUE,
  "kind" text NOT NULL,
  "title_json" text NOT NULL,
  "body_json" text NOT NULL DEFAULT '{}',
  "reward_minor" integer NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'MMK',
  "starts_at" text,
  "ends_at" text,
  "enabled" integer NOT NULL DEFAULT 1,
  "config_json" text NOT NULL DEFAULT '{}',
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "activity_claims" (
  "id" text PRIMARY KEY NOT NULL,
  "player_id" text NOT NULL,
  "activity_id" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "period_key" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "currency" text NOT NULL,
  "status" text NOT NULL DEFAULT 'CLAIMED',
  "ledger_intent_key" text,
  "claimed_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "activity_claims_idempotency_unique"
  ON "activity_claims" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "activity_claims_player_idx"
  ON "activity_claims" ("player_id", "claimed_at");
CREATE TABLE IF NOT EXISTS "checkin_claims" (
  "id" text PRIMARY KEY NOT NULL,
  "player_id" text NOT NULL,
  "day_key" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "currency" text NOT NULL,
  "status" text NOT NULL DEFAULT 'CLAIMED',
  "ledger_intent_key" text,
  "claimed_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_claims_idempotency_unique"
  ON "checkin_claims" ("idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_claims_player_day_unique"
  ON "checkin_claims" ("player_id", "day_key");
`;

/** Admin-configurable defaults — NOT African Buffalo screenshot law (BR-005..007). */
const CHANNEL_SEEDS = [
  {
    code: "KBZ",
    currency: "MMK",
    title: { "zh-CN": "KBZPay", en: "KBZPay", "my-MM": "KBZPay" },
    sort: 1,
    config: { note: "BR-007 PENDING credentials" },
  },
  {
    code: "WAVE",
    currency: "MMK",
    title: { "zh-CN": "WavePay", en: "WavePay", "my-MM": "WavePay" },
    sort: 2,
    config: { note: "BR-007 PENDING credentials" },
  },
  {
    code: "TRC20",
    currency: "USDT",
    title: { "zh-CN": "USDT TRC20", en: "USDT TRC20", "my-MM": "USDT TRC20" },
    sort: 3,
    config: { note: "BR-007/BR-009 PENDING; disabled until multi-currency live" },
    enabled: 0,
  },
] as const;

const CONFIG_SEEDS: Array<{ key: string; value: Record<string, unknown> }> = [
  {
    key: "deposit",
    value: {
      currencies: ["MMK"],
      presetsMinor: [1000, 5000, 10000, 50000],
      minMinor: 1000,
      maxMinor: 500000,
      orderTtlMinutes: 30,
      note: "BR-005 PENDING — admin-replaceable placeholders",
    },
  },
  {
    key: "withdrawal",
    value: {
      currencies: ["MMK"],
      minMinor: 5000,
      maxMinor: 200000,
      dailyCapMinor: 500000,
      feeMinor: 0,
      feeBps: 0,
      reviewAboveMinor: 50000,
      note: "BR-006 PENDING — admin-replaceable placeholders",
    },
  },
  {
    key: "checkin",
    value: {
      enabled: true,
      rewardMinor: 50,
      currency: "MMK",
      note: "BR-003-style pending — admin-replaceable daily check-in",
    },
  },
];

const ACTIVITY_SEEDS = [
  {
    id: "act-welcome-v1",
    code: "WELCOME",
    kind: "EVENT",
    title: { "zh-CN": "欢迎活动", en: "Welcome Event", "my-MM": "ကြိုဆိုပွဲ" },
    body: {
      "zh-CN": "可配置欢迎奖励（占位金额）",
      en: "Configurable welcome reward (placeholder amount)",
      "my-MM": "ပြင်ဆင်နိုင်သော ကြိုဆိုဆု",
    },
    rewardMinor: 100,
    startsAt: "2020-01-01 00:00:00",
    endsAt: "2099-01-01 00:00:00",
  },
  {
    id: "act-expired-v1",
    code: "EXPIRED_DEMO",
    kind: "EVENT",
    title: { "zh-CN": "已过期活动", en: "Expired Event", "my-MM": "သက်တမ်းကုန် ပွဲ" },
    body: {
      "zh-CN": "用于验证过期不可参加",
      en: "Used to verify expired activities are not joinable",
      "my-MM": "သက်တမ်းကုန် မဝင်နိုင်ကြောင်း စမ်းသပ်",
    },
    rewardMinor: 100,
    startsAt: "2020-01-01 00:00:00",
    endsAt: "2020-01-02 00:00:00",
    enabled: 1,
  },
];

const appliedDbs = new WeakSet<object>();

export function resetWalletCommerceBootstrapForTests(): void {
  // WeakSet cannot clear; new db objects get fresh ensure.
}

export async function ensureWalletCommerceSchema(
  db: DrizzleD1Database<typeof schema>,
): Promise<void> {
  const key = db as unknown as object;
  if (appliedDbs.has(key)) return;
  const statements = WALLET_COMMERCE_SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await db.run(sql.raw(statement));
  }
  for (const ch of CHANNEL_SEEDS) {
    await db.run(sql`
      INSERT INTO payment_channels ("code", "title_json", "currency", "enabled", "sort_order", "config_json")
      VALUES (
        ${ch.code},
        ${JSON.stringify(ch.title)},
        ${ch.currency},
        ${"enabled" in ch ? ch.enabled : 1},
        ${ch.sort},
        ${JSON.stringify(ch.config)}
      )
      ON CONFLICT("code") DO NOTHING
    `);
  }
  for (const cfg of CONFIG_SEEDS) {
    await db.run(sql`
      INSERT INTO wallet_commerce_config ("key", "value_json")
      VALUES (${cfg.key}, ${JSON.stringify(cfg.value)})
      ON CONFLICT("key") DO NOTHING
    `);
  }
  for (const act of ACTIVITY_SEEDS) {
    await db.run(sql`
      INSERT INTO player_activities
        ("id", "code", "kind", "title_json", "body_json", "reward_minor", "currency",
         "starts_at", "ends_at", "enabled")
      VALUES (
        ${act.id},
        ${act.code},
        ${act.kind},
        ${JSON.stringify(act.title)},
        ${JSON.stringify(act.body)},
        ${act.rewardMinor},
        'MMK',
        ${act.startsAt},
        ${act.endsAt},
        ${"enabled" in act ? (act as { enabled: number }).enabled : 1}
      )
      ON CONFLICT("id") DO NOTHING
    `);
  }
  appliedDbs.add(key);
}

export async function ensureWalletCommerceReady(
  db: DrizzleD1Database<typeof schema>,
): Promise<void> {
  await ensureWalletCommerceSchema(db);
}
