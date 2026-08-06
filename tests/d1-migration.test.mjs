import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Miniflare } from "miniflare";

function migrationSqlFiles() {
  const base = join(process.cwd(), "drizzle");
  return [
    "0000_early_power_pack.sql",
    "0001_steady_annihilus.sql",
    "0002_session_currency.sql",
    "0003_round_lease.sql",
  ].map((name) => ({
    name,
    sql: readFileSync(join(base, name), "utf8"),
  }));
}

function assertNoForeignKeysOff(sql) {
  assert.equal(
    /PRAGMA\s+foreign_keys\s*=\s*OFF/i.test(sql),
    false,
    "D1 migrations must not use PRAGMA foreign_keys=OFF",
  );
}

async function withD1(run) {
  const mf = new Miniflare({
    modules: true,
    script: `export default { fetch() { return new Response("ok"); } }`,
    d1Databases: { DB: ":memory:" },
  });
  try {
    const db = await mf.getD1Database("DB");
    return await run(db);
  } finally {
    await mf.dispose();
  }
}

async function execMigration(db, sqlText) {
  const statements = sqlText
    .split(/-->\s*statement-breakpoint\s*/g)
    .map((part) =>
      part
        .split("\n")
        .filter((line) => !/^\s*--/.test(line))
        .join("\n")
        .trim(),
    )
    .filter((part) => part.length > 0);
  // D1 batch applies the migration unit atomically (wrangler-equivalent).
  await db.batch(statements.map((sql) => db.prepare(sql)));
}

test("0002/0003 SQL is D1-compatible (defer_foreign_keys, no foreign_keys=OFF)", () => {
  for (const file of migrationSqlFiles()) {
    if (file.name.startsWith("0002") || file.name.startsWith("0003")) {
      assertNoForeignKeysOff(file.sql);
      assert.match(file.sql, /PRAGMA\s+defer_foreign_keys\s*=\s*on/i);
    }
  }
  const m0002 = migrationSqlFiles().find((f) => f.name.startsWith("0002")).sql;
  assert.match(m0002, /INSERT INTO `game_sessions_new`/);
  assert.doesNotMatch(
    m0002,
    /INSERT INTO `game_sessions_new`[\s\S]*WHERE `currency` IS NOT NULL/,
  );
});

test("Miniflare D1 applies all migrations with rounds referencing sessions", async () => {
  await withD1(async (db) => {
    const files = migrationSqlFiles();
    await execMigration(db, files[0].sql);
    await execMigration(db, files[1].sql);

    await db
      .prepare(
        `INSERT INTO players (id, wallet_adapter_ref, currency) VALUES (?, ?, ?)`,
      )
      .bind("p1", "ref1", "MMK")
      .run();
    await db
      .prepare(
        `INSERT INTO game_math_versions (id, sha256, config_json) VALUES (?, ?, ?)`,
      )
      .bind("v1", "deadbeef", "{}")
      .run();
    await db
      .prepare(
        `INSERT INTO game_sessions (id, player_id, math_version_id, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind("s1", "p1", "v1", "2099-01-01T00:00:00.000Z")
      .run();
    await db
      .prepare(
        `INSERT INTO game_rounds
         (id, session_id, player_id, math_version_id, idempotency_key, request_hash, currency, total_bet_minor, request_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind("r1", "s1", "p1", "v1", "idem-1", "hash", "MMK", 50, "{}")
      .run();
    await db
      .prepare(
        `INSERT INTO ledger_transactions
         (id, idempotency_key, round_id, kind, request_hash)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind("lt1", "lt-idem-1", "r1", "SPIN", "h")
      .run();

    await execMigration(db, files[2].sql);

    const session = await db
      .prepare(`SELECT currency FROM game_sessions WHERE id = ?`)
      .bind("s1")
      .first();
    assert.equal(session.currency, "MMK");

    const roundBefore = await db
      .prepare(`SELECT id FROM game_rounds WHERE id = ?`)
      .bind("r1")
      .first();
    assert.equal(roundBefore.id, "r1");

    await execMigration(db, files[3].sql);

    const info = await db.prepare(`PRAGMA table_info(game_rounds)`).all();
    const cols = Object.fromEntries(info.results.map((c) => [c.name, c]));
    assert.ok(cols.claim_token);
    assert.ok(cols.lease_expires_at);
    assert.ok(cols.updated_at);
    assert.ok(cols.free_game_reserved);
    assert.ok(cols.free_games_awarded);
    assert.ok(cols.wallet_applied);
    assert.equal(cols.updated_at.notnull, 0);

    const round = await db
      .prepare(
        `SELECT wallet_applied, free_game_reserved, free_games_awarded, updated_at
         FROM game_rounds WHERE id = ?`,
      )
      .bind("r1")
      .first();
    assert.equal(round.wallet_applied, 0);
    assert.equal(round.free_game_reserved, 0);
    assert.equal(round.free_games_awarded, 0);
    assert.ok(round.updated_at);

    const ledger = await db
      .prepare(`SELECT round_id FROM ledger_transactions WHERE id = ?`)
      .bind("lt1")
      .first();
    assert.equal(ledger.round_id, "r1", "child FK rows must survive session/round rebuild");

    await assert.rejects(
      () =>
        db
          .prepare(`UPDATE game_rounds SET free_games_awarded = -1 WHERE id = ?`)
          .bind("r1")
          .run(),
      /CHECK|constraint/i,
    );
  });
});

test("Miniflare D1 0002 fails on illegal backfilled currency and keeps sessions", async () => {
  await withD1(async (db) => {
    const files = migrationSqlFiles();
    await execMigration(db, files[0].sql);
    await execMigration(db, files[1].sql);

    // players allow length=3 without uppercase GLOB — 'mmk' backfills then fails session format guard.
    await db
      .prepare(
        `INSERT INTO players (id, wallet_adapter_ref, currency) VALUES (?, ?, ?)`,
      )
      .bind("p1", "ref1", "mmk")
      .run();
    await db
      .prepare(
        `INSERT INTO game_math_versions (id, sha256, config_json) VALUES (?, ?, ?)`,
      )
      .bind("v1", "deadbeef", "{}")
      .run();
    await db
      .prepare(
        `INSERT INTO game_sessions (id, player_id, math_version_id, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind("s1", "p1", "v1", "2099-01-01")
      .run();

    await assert.rejects(() => execMigration(db, files[2].sql), /CHECK|constraint/i);

    const sessions = await db.prepare(`SELECT COUNT(*) AS c FROM game_sessions`).first();
    assert.equal(Number(sessions.c), 1, "must not silently delete illegal sessions");
  });
});
