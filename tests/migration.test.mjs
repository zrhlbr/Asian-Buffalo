import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

function migrationFiles() {
  const base = join(process.cwd(), "drizzle");
  return ["0000_early_power_pack.sql", "0001_steady_annihilus.sql"].map((name) =>
    readFileSync(join(base, name), "utf8"),
  );
}

test("all migrations apply cleanly to a fresh empty database", () => {
  const sqlite = new Database(":memory:");
  for (const sql of migrationFiles()) {
    sqlite.exec(sql);
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
      "ledger_entries",
      "ledger_transactions",
      "players",
    ],
  );

  const columns = sqlite
    .prepare("PRAGMA table_info(game_rounds)")
    .all()
    .map((c) => c.name);
  assert.ok(columns.includes("request_payload"), "request_payload column must exist");

  sqlite.close();
});

test("incremental migration applies cleanly on top of baseline", () => {
  const sqlite = new Database(":memory:");
  const [baseline, incremental] = migrationFiles();
  sqlite.exec(baseline);

  // Simulate the baseline already containing some data.
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

  // Apply incremental migration.
  sqlite.exec(incremental);

  const columns = sqlite
    .prepare("PRAGMA table_info(game_rounds)")
    .all()
    .map((c) => c.name);
  assert.ok(columns.includes("request_payload"), "request_payload column must exist after incremental migration");

  // Existing data must remain intact.
  const round = sqlite.prepare("SELECT * FROM game_rounds WHERE id = 'r1'").get();
  assert.equal(round.total_bet_minor, 50);
  assert.equal(round.request_payload, null);

  sqlite.close();
});

test("schema enforces required constraints", () => {
  const sqlite = new Database(":memory:");
  for (const sql of migrationFiles()) {
    sqlite.exec(sql);
  }

  // Player currency must be 3 characters.
  assert.throws(
    () =>
      sqlite.exec(
        `INSERT INTO players (id, wallet_adapter_ref, currency) VALUES ('p2', 'ref2', 'MMKK');`,
      ),
    /CHECK constraint failed/i,
  );

  // Game rounds must have non-negative bet.
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
