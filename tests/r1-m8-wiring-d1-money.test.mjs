/**
 * Wiring proof: D1 money stores + MoneyService settle persist wallet/ledger rows
 * that Admin queries can read (same player/round/idempotency).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createTestDb } from "./db-helper.mjs";
import { D1IntentStore, D1Ledger, D1ProviderStore } from "../lib/d1-money-stores.ts";
import { MoneyService } from "../lib/money-service.ts";
import { DbWalletAdapter } from "../lib/db-wallet-adapter.ts";
import { listPlayerAnnouncements } from "../lib/player-announcements.ts";
import { ensureAdminSchema } from "../lib/admin/admin-bootstrap.ts";

test("D1 MoneyService settle writes wallet_intents + ledger_transactions with round_id", async () => {
  const { db, sqlite } = createTestDb();
  sqlite.pragma("foreign_keys = OFF"); // isolate money layer without full round graph

  const schema = await import("../db/schema.ts");
  await db.insert(schema.players).values({
    id: "wire-player",
    walletAdapterRef: "wallet_wire-player",
    currency: "MMK",
    status: "ACTIVE",
  });

  const money = new MoneyService({
    mode: "TEST",
    ledger: new D1Ledger(db),
    intents: new D1IntentStore(db),
    providers: new D1ProviderStore(db),
  });
  const wallet = new DbWalletAdapter(money);
  await wallet.creditAvailable("wire-player", "MMK", 100_000);
  assert.equal(await wallet.getAvailableBalance("wire-player", "MMK"), 100_000);

  const settled = await wallet.settleRound({
    idempotencyKey: "wire-spin-1",
    playerId: "wire-player",
    currency: "MMK",
    betMinor: 50,
    winMinor: 20,
    isFreeGame: false,
    roundId: "round_wire_1",
  });
  assert.equal(settled.playerBalanceAfterMinor, 99_970);

  const intents = sqlite
    .prepare(
      `SELECT player_id, idempotency_key, status, ledger_tx_id FROM wallet_intents WHERE player_id = ?`,
    )
    .all("wire-player");
  assert.equal(intents.length, 1);
  assert.equal(intents[0].status, "SUCCESS");
  assert.ok(intents[0].ledger_tx_id);

  const txs = sqlite
    .prepare(
      `SELECT id, round_id, kind, status FROM ledger_transactions WHERE idempotency_key = ?`,
    )
    .all("ledger:wire-spin-1");
  assert.equal(txs.length, 1);
  assert.equal(txs[0].round_id, "round_wire_1");
  assert.equal(txs[0].status, "POSTED");

  const bal = sqlite
    .prepare(`SELECT balance_minor FROM ledger_accounts WHERE id = ?`)
    .get("wire-player:PLAYER_AVAILABLE:MMK");
  assert.equal(bal.balance_minor, 99_970);
});

test("player announcements hide unpublished, future publishAt, and expired", async () => {
  const { db, sqlite } = createTestDb();
  await ensureAdminSchema(db);

  const now = Date.now();
  const past = new Date(now - 60_000).toISOString();
  const future = new Date(now + 3600_000).toISOString();
  const expired = new Date(now - 1000).toISOString();

  const insert = sqlite.prepare(
    `INSERT INTO admin_announcements (id, title, content, level, status, created_by) VALUES (?, ?, ?, 'INFO', ?, 'admin')`,
  );
  insert.run(
    "a1",
    "Live",
    JSON.stringify({ zh: "你好", en: "Hello", my: "မင်္ဂလာပါ", publishAt: past, expiresAt: null }),
    "PUBLISHED",
  );
  insert.run("a2", "Draft", JSON.stringify({ zh: "x", en: "x", my: "x" }), "UNPUBLISHED");
  insert.run(
    "a3",
    "Future",
    JSON.stringify({ zh: "f", en: "f", my: "f", publishAt: future }),
    "PUBLISHED",
  );
  insert.run(
    "a4",
    "Expired",
    JSON.stringify({ zh: "e", en: "e", my: "e", publishAt: past, expiresAt: expired }),
    "PUBLISHED",
  );

  const items = await listPlayerAnnouncements(db);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, "a1");
  assert.equal(items[0].locales.en, "Hello");
});
