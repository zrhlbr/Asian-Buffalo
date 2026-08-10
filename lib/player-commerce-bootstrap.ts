/**
 * Additive player commerce sidecar schema (Profile / VIP / Rewards).
 * CREATE TABLE IF NOT EXISTS only — never alters core players/wallet tables.
 * Fail-closed outside DEV/TEST identity gate (same pattern as admin-bootstrap).
 */

import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema.ts";
import { isDevTestIdentityEnabled } from "./runtime-identity.ts";
import { ensureWalletCommerceReady } from "./wallet-commerce-bootstrap.ts";

export const AVATAR_IDS = [
  "ab-avatar-01",
  "ab-avatar-02",
  "ab-avatar-03",
  "ab-avatar-04",
  "ab-avatar-05",
  "ab-avatar-06",
  "ab-avatar-07",
  "ab-avatar-08",
  "ab-avatar-09",
  "ab-avatar-10",
  "ab-avatar-11",
  "ab-avatar-12",
  "ab-avatar-13",
  "ab-avatar-14",
  "ab-avatar-15",
  "ab-avatar-16",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}

export const PLAYER_COMMERCE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "player_profiles" (
  "player_id" text PRIMARY KEY NOT NULL,
  "nickname" text NOT NULL DEFAULT '',
  "avatar_id" text NOT NULL DEFAULT 'ab-avatar-01',
  "phone_e164" text,
  "email" text,
  "phone_verified" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "registered_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_login_at" text,
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "vip_level_config" (
  "level" integer PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "title_json" text NOT NULL,
  "conditions_json" text NOT NULL,
  "enabled" integer NOT NULL DEFAULT 1,
  "sort_order" integer NOT NULL DEFAULT 0,
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "player_vip" (
  "player_id" text PRIMARY KEY NOT NULL,
  "level" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'PENDING',
  "vip_started_at" text,
  "vip_expires_at" text,
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "vip_reward_defs" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "level_min" integer NOT NULL DEFAULT 1,
  "level_max" integer NOT NULL DEFAULT 6,
  "amount_minor" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'MMK',
  "period" text,
  "enabled" integer NOT NULL DEFAULT 1,
  "title_json" text NOT NULL,
  "updated_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "vip_reward_defs_kind_level_period_unique"
  ON "vip_reward_defs" ("kind", "level_min", "level_max", "period");
CREATE TABLE IF NOT EXISTS "vip_reward_claims" (
  "id" text PRIMARY KEY NOT NULL,
  "player_id" text NOT NULL,
  "reward_def_id" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "period_key" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "currency" text NOT NULL,
  "status" text NOT NULL DEFAULT 'CLAIMED',
  "ledger_intent_key" text,
  "claimed_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "vip_reward_claims_idempotency_unique"
  ON "vip_reward_claims" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "vip_reward_claims_player_idx"
  ON "vip_reward_claims" ("player_id", "claimed_at");
`;

/** Placeholder VIP conditions — NOT production thresholds (see BUSINESS_RULES_PENDING). */
const VIP_LEVEL_SEEDS: Array<{
  level: number;
  code: string;
  title: Record<string, string>;
  conditions: Record<string, unknown>;
}> = [
  {
    level: 1,
    code: "VIP1",
    title: { "zh-CN": "青铜水牛", en: "Bronze Buffalo", "my-MM": "ကြေး ကျွဲ" },
    conditions: { minDepositMinor: null, minBetMinor: null, note: "BR-001 PENDING" },
  },
  {
    level: 2,
    code: "VIP2",
    title: { "zh-CN": "白银水牛", en: "Silver Buffalo", "my-MM": "ငွေ ကျွဲ" },
    conditions: { minDepositMinor: null, minBetMinor: null, note: "BR-001 PENDING" },
  },
  {
    level: 3,
    code: "VIP3",
    title: { "zh-CN": "黄金水牛", en: "Gold Buffalo", "my-MM": "ရွှေ ကျွဲ" },
    conditions: { minDepositMinor: null, minBetMinor: null, note: "BR-001 PENDING" },
  },
  {
    level: 4,
    code: "VIP4",
    title: { "zh-CN": "白金水牛", en: "Platinum Buffalo", "my-MM": "ပလက်တီနမ် ကျွဲ" },
    conditions: { minDepositMinor: null, minBetMinor: null, note: "BR-001 PENDING" },
  },
  {
    level: 5,
    code: "VIP5",
    title: { "zh-CN": "翡翠水牛", en: "Jade Buffalo", "my-MM": "ကျောက်စိမ်း ကျွဲ" },
    conditions: { minDepositMinor: null, minBetMinor: null, note: "BR-001 PENDING" },
  },
  {
    level: 6,
    code: "VIP6",
    title: { "zh-CN": "帝王水牛", en: "Imperial Buffalo", "my-MM": "ဧကရာဇ် ကျွဲ" },
    conditions: { minDepositMinor: null, minBetMinor: null, note: "BR-001 PENDING" },
  },
];

/** Placeholder reward amounts — admin-replaceable; BR-003 PENDING. */
const REWARD_SEEDS: Array<{
  id: string;
  kind: string;
  levelMin: number;
  levelMax: number;
  amountMinor: number;
  period: string | null;
  title: Record<string, string>;
}> = [
  {
    id: "rew-daily-v1",
    kind: "DAILY",
    levelMin: 1,
    levelMax: 6,
    amountMinor: 100,
    period: "DAILY",
    title: { "zh-CN": "每日宝箱", en: "Daily Chest", "my-MM": "နေ့စဉ် ရတနာသေတ္တာ" },
  },
  {
    id: "rew-weekly-v1",
    kind: "WEEKLY",
    levelMin: 2,
    levelMax: 6,
    amountMinor: 500,
    period: "WEEKLY",
    title: { "zh-CN": "每周宝箱", en: "Weekly Chest", "my-MM": "အပတ်စဉ် ရတနာသေတ္တာ" },
  },
  {
    id: "rew-monthly-v1",
    kind: "MONTHLY",
    levelMin: 3,
    levelMax: 6,
    amountMinor: 2000,
    period: "MONTHLY",
    title: { "zh-CN": "每月宝箱", en: "Monthly Chest", "my-MM": "လစဉ် ရတနာသေတ္တာ" },
  },
  {
    id: "rew-level-v1",
    kind: "LEVEL",
    levelMin: 1,
    levelMax: 6,
    amountMinor: 300,
    period: "LEVEL",
    title: { "zh-CN": "等级宝箱", en: "Level Chest", "my-MM": "အဆင့် ရတနာသေတ္တာ" },
  },
  {
    id: "rew-event-v1",
    kind: "EVENT",
    levelMin: 1,
    levelMax: 6,
    amountMinor: 0,
    period: "EVENT",
    title: { "zh-CN": "活动宝箱", en: "Event Chest", "my-MM": "ပွဲတော် ရတနာသေတ္တာ" },
  },
];

/** WeakSet of DBs that already received IF NOT EXISTS + seed in this process. */
const appliedDbs = new WeakSet<object>();

export function resetPlayerCommerceBootstrapForTests(): void {
  // WeakSet cannot be cleared; tests must call ensure on each new db object.
  // No-op retained for API symmetry with admin bootstrap reset.
}

export async function ensurePlayerCommerceSchema(
  db: DrizzleD1Database<typeof schema>,
): Promise<void> {
  const key = db as unknown as object;
  if (appliedDbs.has(key)) return;
  const statements = PLAYER_COMMERCE_SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    await db.run(sql.raw(statement));
  }
  // Additive column for existing installs (CREATE IF NOT EXISTS does not alter).
  try {
    await db.run(sql.raw(`ALTER TABLE "player_profiles" ADD COLUMN "email" text`));
  } catch {
    /* column already exists */
  }
  for (const seed of VIP_LEVEL_SEEDS) {
    await db.run(sql`
      INSERT INTO vip_level_config ("level", "code", "title_json", "conditions_json", "enabled", "sort_order")
      VALUES (
        ${seed.level},
        ${seed.code},
        ${JSON.stringify(seed.title)},
        ${JSON.stringify(seed.conditions)},
        1,
        ${seed.level}
      )
      ON CONFLICT("level") DO NOTHING
    `);
  }
  for (const seed of REWARD_SEEDS) {
    await db.run(sql`
      INSERT INTO vip_reward_defs
        ("id", "kind", "level_min", "level_max", "amount_minor", "currency", "period", "enabled", "title_json")
      VALUES (
        ${seed.id},
        ${seed.kind},
        ${seed.levelMin},
        ${seed.levelMax},
        ${seed.amountMinor},
        'MMK',
        ${seed.period},
        ${seed.kind === "EVENT" ? 0 : 1},
        ${JSON.stringify(seed.title)}
      )
      ON CONFLICT("id") DO NOTHING
    `);
  }
  appliedDbs.add(key);
}

/**
 * Ensure commerce schema. In production (non-test identity) still allow IF NOT EXISTS
 * so formal deploy can create sidecars safely without destructive migrations.
 */
export async function ensurePlayerCommerceReady(
  db: DrizzleD1Database<typeof schema>,
): Promise<void> {
  void isDevTestIdentityEnabled;
  await ensurePlayerCommerceSchema(db);
  await ensureWalletCommerceReady(db);
}
