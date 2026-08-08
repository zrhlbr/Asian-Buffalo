/**
 * Step 5 — payment readiness fail-closed + commerce flags (no Zhao number invention).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createTestDb } from "./db-helper.mjs";
import { ensureWalletCommerceSchema } from "../lib/wallet-commerce-bootstrap.ts";
import {
  getDepositConfig,
  getPaymentCommerceReadiness,
  listPaymentChannels,
} from "../lib/deposit-service.ts";
import { getWithdrawalConfig } from "../lib/withdrawal-service.ts";
import {
  buildCommerceReadiness,
  mapChannelReadiness,
} from "../lib/payment-readiness.ts";

test("BR-005..007 defaults are NOT_PRODUCTION_READY (fail closed)", async () => {
  const { db } = createTestDb();
  await ensureWalletCommerceSchema(db);

  const deposit = await getDepositConfig(db);
  const withdraw = await getWithdrawalConfig(db);
  assert.equal(deposit.productionReady, false);
  assert.equal(withdraw.productionReady, false);

  const channels = await listPaymentChannels(db);
  assert.ok(channels.some((c) => c.code === "KBZ"));
  assert.ok(channels.some((c) => c.code === "WAVE"));
  const trc = channels.find((c) => c.code === "TRC20");
  assert.ok(trc);
  assert.equal(trc.enabled, false);
  assert.equal(trc.readiness.productionReady, false);
  assert.equal(trc.readiness.callbackConfigured, false);
  assert.equal(trc.readiness.provider, "TEMP");

  for (const ch of channels) {
    assert.equal(ch.readiness.productionReady, false);
    assert.notEqual(ch.readiness.status, "PRODUCTION");
  }

  const readiness = await getPaymentCommerceReadiness(db);
  assert.equal(readiness.productionReady, false);
  assert.equal(readiness.code, "NOT_PRODUCTION_READY");
  assert.ok(readiness.brRefs.includes("BR-007"));
});

test("mapChannelReadiness never invents production without explicit flags", () => {
  const ready = mapChannelReadiness({
    code: "KBZ",
    currency: "MMK",
    enabled: true,
    configJson: JSON.stringify({
      productionReady: true,
      provider: "KBZ_LIVE",
      callbackConfigured: true,
    }),
  });
  assert.equal(ready.status, "PRODUCTION");

  const temp = mapChannelReadiness({
    code: "WAVE",
    currency: "MMK",
    enabled: true,
    configJson: { note: "pending" },
  });
  assert.equal(temp.productionReady, false);
  assert.equal(temp.status, "TEMP");
  assert.equal(temp.provider, "TEMP");

  const aggregate = buildCommerceReadiness([temp], {
    depositProductionReady: false,
    withdrawalProductionReady: false,
  });
  assert.equal(aggregate.code, "NOT_PRODUCTION_READY");
});
