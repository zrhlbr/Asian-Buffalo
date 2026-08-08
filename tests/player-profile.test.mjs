import assert from "node:assert/strict";
import test from "node:test";
import { createTestDb } from "./db-helper.mjs";
import {
  resetPlayerCommerceBootstrapForTests,
  ensurePlayerCommerceSchema,
  isAvatarId,
} from "../lib/player-commerce-bootstrap.ts";
import {
  getPlayerProfile,
  isValidE164,
  isValidNickname,
  maskPhone,
  updateAvatar,
  updateNickname,
  updatePhone,
} from "../lib/player-profile.ts";

test("avatar catalog ids are original Asian Buffalo placeholders", () => {
  assert.equal(isAvatarId("ab-avatar-01"), true);
  assert.equal(isAvatarId("ab-avatar-16"), true);
  assert.equal(isAvatarId("african-buffalo-01"), false);
});

test("nickname and phone validators", () => {
  assert.equal(isValidNickname("水牛玩家"), true);
  assert.equal(isValidNickname("a"), false);
  assert.equal(isValidE164("+959123456789"), true);
  assert.equal(isValidE164("09123456789"), false);
  assert.equal(maskPhone("+959123456789"), "****6789");
});

test("profile CRUD sidecar never mutates balance columns", async () => {
  resetPlayerCommerceBootstrapForTests();
  const { db } = createTestDb();
  await ensurePlayerCommerceSchema(db);
  const { sql } = await import("drizzle-orm");
  await db.run(sql`
    INSERT INTO players ("id", "wallet_adapter_ref", "currency", "status")
    VALUES ('p1', 'w_p1', 'MMK', 'ACTIVE')
  `);

  const created = await getPlayerProfile(db, "p1");
  assert.ok(created);
  assert.equal(created.currency, "MMK");
  assert.ok(created.avatarId.startsWith("ab-avatar-"));

  const nick = await updateNickname(db, "p1", "BuffaloKing");
  assert.equal(nick.ok, true);
  if (nick.ok) assert.equal(nick.profile.nickname, "BuffaloKing");

  const av = await updateAvatar(db, "p1", "ab-avatar-08");
  assert.equal(av.ok, true);
  if (av.ok) assert.equal(av.profile.avatarId, "ab-avatar-08");

  const phone = await updatePhone(db, "p1", "+959111222333");
  assert.equal(phone.ok, true);
  if (phone.ok) {
    assert.equal(phone.profile.phoneMasked, "****2333");
    assert.equal(phone.profile.phoneVerified, false);
  }
});
