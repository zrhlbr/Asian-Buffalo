/**
 * P3 Player Auth — register / login / reset / hash / idempotent init.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createTestDb } from "./db-helper.mjs";
import { MoneyService } from "../lib/money-service.ts";
import { ensurePlayerAuthReady } from "../lib/player-auth-bootstrap.ts";
import {
  hashPlayerPassword,
  isValidPassword,
  verifyPlayerPassword,
} from "../lib/player-password.ts";
import {
  AUTH_OTP_TEST_CODE,
  isAuthOtpTestMode,
  SkSmsDeviceStubAdapter,
  SmtpEmailStubAdapter,
} from "../lib/otp-providers.ts";
import {
  authForgotReset,
  authForgotStart,
  authLogin,
  authRegisterComplete,
  authRegisterStart,
  authRegisterVerify,
} from "../lib/player-auth-service.ts";
import { seedDevTestWalletIfEmpty } from "../lib/dev-test-bootstrap.ts";
import { DEV_TEST_PLAYER_ID } from "../lib/runtime-identity.ts";

function fakeRequest(extra = {}) {
  return new Request("http://localhost/api/v1/auth/test", {
    method: "POST",
    headers: {
      "user-agent": "P3AuthTest/1.0",
      "x-forwarded-for": "203.0.113.9",
      ...extra.headers,
    },
  });
}

test("password validator and PBKDF2 hash verify", async () => {
  assert.equal(isValidPassword("short"), false);
  assert.equal(isValidPassword("abcdefgh"), false);
  assert.equal(isValidPassword("abcdefg1"), true);
  const { hash, salt, algo } = await hashPlayerPassword("Secret123");
  assert.equal(algo, "pbkdf2-sha256");
  assert.equal(await verifyPlayerPassword("Secret123", { passwordHash: hash, passwordSalt: salt, passwordAlgo: algo }), true);
  assert.equal(await verifyPlayerPassword("wrong999", { passwordHash: hash, passwordSalt: salt, passwordAlgo: algo }), false);
});

test("OTP stubs fail-closed without test mode; accept test mode", async () => {
  const prev = process.env.AB_AUTH_OTP_TEST_MODE;
  delete process.env.AB_AUTH_OTP_TEST_MODE;
  const sms = new SkSmsDeviceStubAdapter();
  const mail = new SmtpEmailStubAdapter();
  const smsFail = await sms.sendSms("+959111222333", "x");
  const mailFail = await mail.sendEmail("a@b.com", "s", "b");
  assert.equal(smsFail.ok, false);
  assert.equal(smsFail.code, "PROVIDER_NOT_CONFIGURED");
  assert.equal(mailFail.ok, false);

  process.env.AB_AUTH_OTP_TEST_MODE = "1";
  assert.equal(isAuthOtpTestMode(), true);
  assert.equal(AUTH_OTP_TEST_CODE, "123456");
  const smsOk = await sms.sendSms("+959111222333", "x");
  assert.equal(smsOk.ok, true);
  assert.equal(smsOk.mode, "test");

  if (prev === undefined) delete process.env.AB_AUTH_OTP_TEST_MODE;
  else process.env.AB_AUTH_OTP_TEST_MODE = prev;
});

test("phone register → login → wallet zero → forgot reset", async () => {
  process.env.AB_AUTH_OTP_TEST_MODE = "1";
  const { db } = createTestDb();
  await ensurePlayerAuthReady(db);
  const money = new MoneyService({ mode: "TEST" });
  const phone = "+959987654321";
  const req = fakeRequest();

  const start = await authRegisterStart(db, { channel: "sms", destination: phone, request: req });
  assert.equal(start.ok, true);
  if (!start.ok) return;

  const verified = await authRegisterVerify(db, {
    challengeId: start.challengeId,
    code: AUTH_OTP_TEST_CODE,
    request: req,
  });
  assert.equal(verified.ok, true);

  const completed = await authRegisterComplete(db, money, {
    challengeId: start.challengeId,
    code: AUTH_OTP_TEST_CODE,
    password: "Buffalo1",
    nickname: "水牛玩家",
    request: req,
  });
  assert.equal(completed.ok, true);
  if (!completed.ok) return;
  assert.equal(completed.wallet.balanceMinor, 0);
  assert.equal(completed.profile.nickname, "水牛玩家");
  assert.ok(completed.setCookies.some((c) => c.startsWith("ab_player=")));

  // Idempotent-ish: second complete with same challenge fails (consumed)
  const again = await authRegisterComplete(db, money, {
    challengeId: start.challengeId,
    code: AUTH_OTP_TEST_CODE,
    password: "Buffalo1",
    request: req,
  });
  assert.equal(again.ok, false);

  const login = await authLogin(db, money, {
    channel: "sms",
    destination: phone,
    password: "Buffalo1",
    request: req,
  });
  assert.equal(login.ok, true);
  if (!login.ok) return;
  assert.equal(login.playerId, completed.playerId);
  assert.equal(login.wallet.balanceMinor, 0);

  const bad = await authLogin(db, money, {
    channel: "sms",
    destination: phone,
    password: "Wrong999",
    request: req,
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "INVALID_CREDENTIALS");

  const forgot = await authForgotStart(db, { channel: "sms", destination: phone, request: req });
  assert.equal(forgot.ok, true);
  if (!forgot.ok) return;
  const reset = await authForgotReset(db, {
    challengeId: forgot.challengeId,
    code: AUTH_OTP_TEST_CODE,
    password: "Buffalo2",
    request: req,
  });
  assert.equal(reset.ok, true);

  const login2 = await authLogin(db, money, {
    channel: "sms",
    destination: phone,
    password: "Buffalo2",
    request: req,
  });
  assert.equal(login2.ok, true);
});

test("email register path", async () => {
  process.env.AB_AUTH_OTP_TEST_MODE = "1";
  const { db } = createTestDb();
  await ensurePlayerAuthReady(db);
  const money = new MoneyService({ mode: "TEST" });
  const email = "hero@example.com";
  const req = fakeRequest();

  const start = await authRegisterStart(db, { channel: "email", destination: email, request: req });
  assert.equal(start.ok, true);
  if (!start.ok) return;
  const completed = await authRegisterComplete(db, money, {
    challengeId: start.challengeId,
    code: AUTH_OTP_TEST_CODE,
    password: "EmailPass1",
    request: req,
  });
  assert.equal(completed.ok, true);
  if (!completed.ok) return;

  const login = await authLogin(db, money, {
    channel: "email",
    destination: "Hero@Example.com",
    password: "EmailPass1",
    request: req,
  });
  assert.equal(login.ok, true);
});

test("DevTest wallet seed never applies to auth-created player ids", async () => {
  process.env.AB_ALLOW_TEST_IDENTITY = "1";
  const wallet = {
    balances: new Map(),
    async getAvailableBalance(playerId) {
      return this.balances.get(playerId) ?? 0;
    },
    async creditAvailable(playerId, _c, amount) {
      this.balances.set(playerId, amount);
    },
  };
  const authPlayer = "pl_auth_only_1";
  const seededAuth = await seedDevTestWalletIfEmpty(wallet, authPlayer, "MMK");
  assert.equal(seededAuth, 0);
  assert.equal(wallet.balances.has(authPlayer), false);

  const seededDev = await seedDevTestWalletIfEmpty(wallet, DEV_TEST_PLAYER_ID, "MMK");
  assert.equal(seededDev, 100_000);
});
