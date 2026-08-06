import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

function migrationFiles() {
  const base = join(process.cwd(), "drizzle");
  return [
    "0000_early_power_pack.sql",
    "0001_steady_annihilus.sql",
    "0002_session_currency.sql",
    "0003_round_lease.sql",
    "0004_wallet_money_layer.sql",
  ].map((name) => readFileSync(join(base, name), "utf8"));
}

/** Apply a migration file inside one transaction (matches D1/wrangler apply). */
function applyMigration(sqlite, sqlText) {
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.exec(sqlText);
    sqlite.exec("COMMIT");
  } catch (error) {
    try {
      sqlite.exec("ROLLBACK");
    } catch {
      // ignore
    }
    throw error;
  }
}

test("drizzle meta snapshots exist for 0002/0003/0004 and journal includes them", () => {
  const meta = join(process.cwd(), "drizzle", "meta");
  assert.equal(existsSync(join(meta, "0002_snapshot.json")), true);
  assert.equal(existsSync(join(meta, "0003_snapshot.json")), true);
  assert.equal(existsSync(join(meta, "0004_snapshot.json")), true);
  const journal = JSON.parse(readFileSync(join(meta, "_journal.json"), "utf8"));
  assert.deepEqual(
    journal.entries.map((e) => e.tag),
    [
      "0000_early_power_pack",
      "0001_steady_annihilus",
      "0002_session_currency",
      "0003_round_lease",
      "0004_wallet_money_layer",
    ],
  );
  const snap = JSON.parse(readFileSync(join(meta, "0002_snapshot.json"), "utf8"));
  assert.equal(snap.tables.game_sessions.columns.currency.notNull, true);
  assert.ok(snap.tables.game_sessions.checkConstraints.game_sessions_currency_length);
  assert.ok(snap.tables.game_sessions.checkConstraints.game_sessions_currency_format);
  const snap3 = JSON.parse(readFileSync(join(meta, "0003_snapshot.json"), "utf8"));
  assert.ok(snap3.tables.game_rounds.columns.claim_token);
  assert.ok(snap3.tables.game_rounds.columns.wallet_applied);
  assert.equal(
    snap3.tables.game_rounds.columns.updated_at.default,
    "CURRENT_TIMESTAMP",
  );
  assert.ok(
    snap3.tables.game_rounds.checkConstraints.game_rounds_free_games_awarded_nonnegative,
  );
});

test("0002/0003 migrations never disable foreign_keys", () => {
  const [, , m0002, m0003] = migrationFiles();
  for (const sql of [m0002, m0003]) {
    assert.equal(/PRAGMA\s+foreign_keys\s*=\s*OFF/i.test(sql), false);
    assert.match(sql, /PRAGMA\s+defer_foreign_keys\s*=\s*on/i);
  }
  assert.doesNotMatch(
    m0002,
    /INSERT INTO `game_sessions_new`[\s\S]*WHERE `currency` IS NOT NULL/,
  );
});

test("all migrations apply cleanly to a fresh empty database", () => {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  for (const sql of migrationFiles()) {
    applyMigration(sqlite, sql);
  }

  const tables = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();
  assert.deepEqual(
    tables.map((t) => t.name),
    [
      "audit_events",
      "game_math_versions",
      "game_rounds",
      "game_sessions",
      "ledger_accounts",
      "ledger_balances",
      "ledger_entries",
      "ledger_transactions",
      "players",
      "wallet_intents",
      "wallet_provider_ops",
    ],
  );

  const roundColumns = sqlite
    .prepare("PRAGMA table_info(game_rounds)")
    .all()
    .map((c) => c.name);
  for (const col of [
    "request_payload",
    "claim_token",
    "lease_expires_at",
    "updated_at",
    "free_game_reserved",
    "free_games_awarded",
    "wallet_applied",
  ]) {
    assert.ok(roundColumns.includes(col), `missing round column ${col}`);
  }

  const currency = sqlite
    .prepare("PRAGMA table_info(game_sessions)")
    .all()
    .find((c) => c.name === "currency");
  assert.ok(currency);
  assert.equal(currency.notnull, 1);

  sqlite.close();
});

test("incremental migrations keep sessions referenced by rounds and ledger", () => {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const [baseline, m0001, m0002, m0003] = migrationFiles();
  applyMigration(sqlite, baseline);

  sqlite.exec(
    `INSERT INTO players (id, wallet_adapter_ref, currency) VALUES ('p1', 'ref1', 'MMK');`,
  );
  sqlite.exec(
    `INSERT INTO game_math_versions (id, sha256, config_json) VALUES ('v1', 'deadbeef', '{}');`,
  );
  sqlite.exec(
    `INSERT INTO game_sessions (id, player_id, math_version_id, expires_at) VALUES ('s1', 'p1', 'v1', '2099-01-01');`,
  );
  sqlite.exec(
    `INSERT INTO game_rounds (id, session_id, player_id, math_version_id, idempotency_key, request_hash, currency, total_bet_minor)
     VALUES ('r1', 's1', 'p1', 'v1', 'idem-1', 'hash', 'MMK', 50);`,
  );

  applyMigration(sqlite, m0001);
  sqlite.exec(
    `INSERT INTO ledger_transactions (id, idempotency_key, round_id, kind, request_hash)
     VALUES ('lt1', 'lt-1', 'r1', 'SPIN', 'h');`,
  );

  applyMigration(sqlite, m0002);
  const session = sqlite.prepare("SELECT * FROM game_sessions WHERE id = 's1'").get();
  assert.equal(session.currency, "MMK");
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS c FROM game_rounds").get().c, 1);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS c FROM ledger_transactions").get().c, 1);

  applyMigration(sqlite, m0003);
  const leased = sqlite.prepare("SELECT * FROM game_rounds WHERE id = 'r1'").get();
  assert.equal(leased.wallet_applied, 0);
  assert.equal(leased.free_games_awarded, 0);
  assert.ok(leased.updated_at);
  assert.equal(
    sqlite.prepare("SELECT round_id FROM ledger_transactions WHERE id = 'lt1'").get().round_id,
    "r1",
  );

  assert.throws(
    () => sqlite.exec(`UPDATE game_rounds SET free_games_awarded = -1 WHERE id = 'r1';`),
    /CHECK constraint failed/i,
  );

  sqlite.close();
});

test("0002 fails closed on illegal currency and does not drop sessions", () => {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const [baseline, m0001, m0002] = migrationFiles();
  applyMigration(sqlite, baseline);
  applyMigration(sqlite, m0001);
  sqlite.exec(
    `INSERT INTO players (id, wallet_adapter_ref, currency) VALUES ('p1', 'ref1', 'mmk');`,
  );
  sqlite.exec(
    `INSERT INTO game_math_versions (id, sha256, config_json) VALUES ('v1', 'deadbeef', '{}');`,
  );
  sqlite.exec(
    `INSERT INTO game_sessions (id, player_id, math_version_id, expires_at) VALUES ('s1', 'p1', 'v1', '2099-01-01');`,
  );

  assert.throws(() => applyMigration(sqlite, m0002), /CHECK constraint failed/i);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS c FROM game_sessions").get().c, 1);

  sqlite.close();
});

test("0002 enforces NOT NULL currency, rejects NULL and illegal formats", () => {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  for (const sql of migrationFiles()) {
    applyMigration(sqlite, sql);
  }

  sqlite.exec(
    `INSERT INTO players (id, wallet_adapter_ref, currency) VALUES ('p1', 'ref1', 'MMK');`,
  );
  sqlite.exec(
    `INSERT INTO game_math_versions (id, sha256, config_json) VALUES ('v1', 'deadbeef', '{}');`,
  );

  assert.throws(
    () =>
      sqlite.exec(
        `INSERT INTO game_sessions (id, player_id, math_version_id, currency, expires_at)
         VALUES ('s-null', 'p1', 'v1', NULL, '2099-01-01');`,
      ),
    /NOT NULL|constraint/i,
  );

  assert.throws(
    () =>
      sqlite.exec(
        `INSERT INTO game_sessions (id, player_id, math_version_id, currency, expires_at)
         VALUES ('s-short', 'p1', 'v1', 'US', '2099-01-01');`,
      ),
    /CHECK constraint failed/i,
  );

  assert.throws(
    () =>
      sqlite.exec(
        `INSERT INTO game_sessions (id, player_id, math_version_id, currency, expires_at)
         VALUES ('s-lower', 'p1', 'v1', 'mmk', '2099-01-01');`,
      ),
    /CHECK constraint failed/i,
  );

  sqlite.close();
});

test("schema enforces required constraints", () => {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  for (const sql of migrationFiles()) {
    applyMigration(sqlite, sql);
  }

  assert.throws(
    () =>
      sqlite.exec(
        `INSERT INTO players (id, wallet_adapter_ref, currency) VALUES ('p2', 'ref2', 'MMKK');`,
      ),
    /CHECK constraint failed/i,
  );

  sqlite.exec(
    `INSERT INTO players (id, wallet_adapter_ref, currency) VALUES ('p1', 'ref1', 'MMK');`,
  );
  sqlite.exec(
    `INSERT INTO game_math_versions (id, sha256, config_json) VALUES ('v1', 'deadbeef', '{}');`,
  );
  sqlite.exec(
    `INSERT INTO game_sessions (id, player_id, math_version_id, currency, expires_at)
     VALUES ('s1', 'p1', 'v1', 'MMK', '2099-01-01');`,
  );

  assert.throws(
    () =>
      sqlite.exec(
        `INSERT INTO game_rounds (id, session_id, player_id, math_version_id, idempotency_key, request_hash, currency, total_bet_minor)
         VALUES ('r2', 's1', 'p1', 'v1', 'idem-2', 'hash', 'MMK', -1);`,
      ),
    /CHECK constraint failed/i,
  );

  sqlite.close();
});
