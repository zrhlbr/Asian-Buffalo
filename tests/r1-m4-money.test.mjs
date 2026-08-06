import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
  assertIntentTransition,
  IllegalIntentTransitionError,
  MemoryIntentStore,
  createWalletIntent,
} from "../lib/wallet-intent.ts";
import {
  assertProviderTransition,
  IllegalProviderTransitionError,
  LocalTestWalletProvider,
  MemoryProviderStore,
} from "../lib/wallet-provider.ts";
import { MemoryLedger } from "../lib/db-ledger.ts";
import { MoneyService } from "../lib/money-service.ts";
import { WalletRecoveryService } from "../lib/wallet-recovery.ts";
import { DbWalletAdapter, RealWalletAdapter } from "../lib/db-wallet-adapter.ts";
import {
  assertRealWalletAllowed,
  assertTestWalletAllowed,
  WalletModeGateError,
} from "../lib/wallet-mode.ts";
import {
  MONEY_LAYER_MIGRATION_VERSION,
  assertMigrationVersionAtLeast,
} from "../lib/migration-version.ts";
import {
  DuplicateIdempotencyKeyError,
  InsufficientBalanceError,
  WalletResultUnknownError,
} from "../lib/wallet-adapter.ts";

test("intent state machine allows happy path and rejects illegal jumps", () => {
  assertIntentTransition("NEW", "LOCKED");
  assertIntentTransition("LOCKED", "PROCESSING");
  assertIntentTransition("PROCESSING", "SUCCESS");
  assertIntentTransition("SUCCESS", "RECOVERED");
  assert.throws(
    () => assertIntentTransition("NEW", "SUCCESS"),
    (e) => e instanceof IllegalIntentTransitionError,
  );
});

test("provider state machine settles without double debit on replay", async () => {
  const store = new MemoryProviderStore();
  const provider = new LocalTestWalletProvider(store);
  const first = await provider.begin({
    id: "op1",
    intentId: "i1",
    idempotencyKey: "pk1",
    currency: "MMK",
    amountMinor: 50,
    direction: "DEBIT",
  });
  const replay = await provider.begin({
    id: "op1-other",
    intentId: "i1",
    idempotencyKey: "pk1",
    currency: "MMK",
    amountMinor: 50,
    direction: "DEBIT",
  });
  assert.equal(replay.id, first.id);
  const settled = await provider.settleLocal(first.id);
  assert.equal(settled.status, "SETTLED");
  const again = await provider.settleLocal(first.id);
  assert.equal(again.status, "SETTLED");
  assert.equal(again.version, settled.version);
  assert.throws(
    () => assertProviderTransition("SETTLED", "PROCESSING"),
    (e) => e instanceof IllegalProviderTransitionError,
  );
});

test("ledger posts are balanced, CAS-safe, and idempotent", () => {
  const ledger = new MemoryLedger();
  const { available, clearing } = ledger.ensurePlayerAccounts("p1", "MMK");
  ledger.forceCreditAvailableForTest("p1", "MMK", 1000);
  const tx = ledger.post({
    idempotencyKey: "L1",
    kind: "GAME_BET",
    requestHash: "h1",
    postings: [
      { accountId: available.id, amountMinor: -50, currency: "MMK", memo: "BET" },
      { accountId: clearing.id, amountMinor: 50, currency: "MMK", memo: "BET" },
    ],
  });
  const replay = ledger.post({
    idempotencyKey: "L1",
    kind: "GAME_BET",
    requestHash: "h1",
    postings: [
      { accountId: available.id, amountMinor: -50, currency: "MMK", memo: "BET" },
      { accountId: clearing.id, amountMinor: 50, currency: "MMK", memo: "BET" },
    ],
  });
  assert.equal(replay.id, tx.id);
  assert.equal(ledger.getBalance(available.id), 950);
  assert.throws(() =>
    ledger.post({
      idempotencyKey: "L1",
      kind: "GAME_BET",
      requestHash: "different",
      postings: [
        { accountId: available.id, amountMinor: -50, currency: "MMK", memo: "BET" },
        { accountId: clearing.id, amountMinor: 50, currency: "MMK", memo: "BET" },
      ],
    }),
  );
  const rev = ledger.reverse("L1", "L1-rev");
  assert.equal(rev.kind, "REVERSAL");
  assert.equal(ledger.getBalance(available.id), 1000);
});

test("money service debit/credit/settle are idempotent and no double spend", async () => {
  const money = new MoneyService({ mode: "TEST" });
  money.seed("p1", "MMK", 500);
  const first = await money.settleRound({
    idempotencyKey: "s1",
    playerId: "p1",
    currency: "MMK",
    betMinor: 50,
    winMinor: 20,
    isFreeGame: false,
  });
  const second = await money.settleRound({
    idempotencyKey: "s1",
    playerId: "p1",
    currency: "MMK",
    betMinor: 50,
    winMinor: 20,
    isFreeGame: false,
  });
  assert.equal(second.playerBalanceAfterMinor, first.playerBalanceAfterMinor);
  assert.equal(await money.getAvailableBalance("p1", "MMK"), 470);
  await assert.rejects(
    () =>
      money.settleRound({
        idempotencyKey: "s1",
        playerId: "p1",
        currency: "MMK",
        betMinor: 99,
        winMinor: 0,
        isFreeGame: false,
      }),
    (e) => e instanceof DuplicateIdempotencyKeyError,
  );
});

test("rollback reverses ledger once", async () => {
  const money = new MoneyService({ mode: "TEST" });
  money.seed("p1", "MMK", 200);
  await money.debit({
    playerId: "p1",
    currency: "MMK",
    amountMinor: 40,
    idempotencyKey: "d1",
  });
  assert.equal(await money.getAvailableBalance("p1", "MMK"), 160);
  await money.rollback({
    playerId: "p1",
    originalIdempotencyKey: "d1",
    rollbackIdempotencyKey: "r1",
  });
  assert.equal(await money.getAvailableBalance("p1", "MMK"), 200);
  await money.rollback({
    playerId: "p1",
    originalIdempotencyKey: "d1",
    rollbackIdempotencyKey: "r1",
  });
  assert.equal(await money.getAvailableBalance("p1", "MMK"), 200);
});

test("timeout/unknown recovery does not double post", async () => {
  const money = new MoneyService({ mode: "TEST" });
  money.seed("p1", "MMK", 300);
  money.forceUnknownAfterProcessing = true;
  await assert.rejects(
    () =>
      money.settleRound({
        idempotencyKey: "u1",
        playerId: "p1",
        currency: "MMK",
        betMinor: 30,
        winMinor: 0,
        isFreeGame: false,
      }),
    (e) => e instanceof WalletResultUnknownError,
  );
  money.forceUnknownAfterProcessing = false;
  const intent = await money.intents.getByIdempotency("p1", "u1");
  assert.equal(intent.status, "UNKNOWN");
  const recovery = new WalletRecoveryService(money);
  const result = await recovery.recoverIntent(intent.id, "UNKNOWN");
  assert.ok(["REPLAYED", "RETRIED", "MARKED_RECOVERED"].includes(result.action));
  const bal = await money.getAvailableBalance("p1", "MMK");
  assert.ok(bal === 270 || bal === 300);
  // Second recovery must not double-debit
  await recovery.recoverIntent(intent.id, "UNKNOWN");
  assert.equal(await money.getAvailableBalance("p1", "MMK"), bal);
});

test("REAL gate fail-closed; TEST gate required for money service", () => {
  assert.throws(
    () => assertRealWalletAllowed("REAL", false),
    (e) => e instanceof WalletModeGateError,
  );
  assert.throws(
    () => assertTestWalletAllowed("REAL"),
    (e) => e instanceof WalletModeGateError,
  );
  const real = new RealWalletAdapter(false);
  assert.throws(() =>
    real.settleRound({
      idempotencyKey: "x",
      playerId: "p",
      currency: "MMK",
      betMinor: 1,
      winMinor: 0,
      isFreeGame: false,
    }),
  );
});

test("DbWalletAdapter settleRound matches MoneyService", async () => {
  const money = new MoneyService({ mode: "TEST" });
  const adapter = new DbWalletAdapter(money);
  adapter.creditAvailable("p1", "MMK", 100);
  const settled = await adapter.settleRound({
    idempotencyKey: "a1",
    playerId: "p1",
    currency: "MMK",
    betMinor: 10,
    winMinor: 5,
    isFreeGame: false,
  });
  assert.equal(settled.playerBalanceAfterMinor, 95);
  assert.equal(await adapter.getAvailableBalance("p1", "MMK"), 95);
});

test("insufficient balance fails closed before provider settle", async () => {
  const money = new MoneyService({ mode: "TEST" });
  money.seed("p1", "MMK", 10);
  await assert.rejects(
    () =>
      money.settleRound({
        idempotencyKey: "poor",
        playerId: "p1",
        currency: "MMK",
        betMinor: 50,
        winMinor: 0,
        isFreeGame: false,
      }),
    (e) => e instanceof InsufficientBalanceError,
  );
  const intent = await money.intents.getByIdempotency("p1", "poor");
  assert.equal(intent.status, "FAILED");
  assert.equal(await money.getAvailableBalance("p1", "MMK"), 10);
});

test("migration 0004 forward + down apply on sqlite", () => {
  const sqlite = new Database(":memory:");
  const base = join(process.cwd(), "drizzle");
  const forwardFiles = [
    "0000_early_power_pack.sql",
    "0001_steady_annihilus.sql",
    "0002_session_currency.sql",
    "0003_round_lease.sql",
    "0004_wallet_money_layer.sql",
  ];
  const execSql = (text) => {
    for (const part of text.split(/-->\s*statement-breakpoint\s*/g)) {
      const sql = part
        .split("\n")
        .filter((line) => !/^\s*--/.test(line))
        .join("\n")
        .trim();
      if (sql) sqlite.exec(sql);
    }
  };
  for (const name of forwardFiles) {
    execSql(readFileSync(join(base, name), "utf8"));
  }
  const tables = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all()
    .map((r) => r.name);
  assert.ok(tables.includes("wallet_intents"));
  assert.ok(tables.includes("wallet_provider_ops"));
  assert.ok(tables.includes("ledger_balances"));
  execSql(readFileSync(join(base, "down", "0004_wallet_money_layer.sql"), "utf8"));
  const after = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all()
    .map((r) => r.name);
  assert.equal(after.includes("wallet_intents"), false);
  assert.equal(after.includes("ledger_balances"), false);
  // re-apply 0004
  execSql(readFileSync(join(base, "0004_wallet_money_layer.sql"), "utf8"));
  assert.ok(
    sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='wallet_intents'`)
      .get(),
  );
  assertMigrationVersionAtLeast(MONEY_LAYER_MIGRATION_VERSION);
  assert.throws(() => assertMigrationVersionAtLeast(3));
});

test("intent CAS rejects stale version", async () => {
  const store = new MemoryIntentStore();
  const intent = await store.insert(
    createWalletIntent({
      id: "i1",
      playerId: "p",
      idempotencyKey: "k",
      operation: "DEBIT",
      currency: "MMK",
      amountMinor: 1,
      requestHash: "h",
    }),
  );
  await store.transition(intent.id, 0, "LOCKED");
  await assert.rejects(() => store.transition(intent.id, 0, "PROCESSING"));
});
