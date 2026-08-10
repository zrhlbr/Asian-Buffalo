import assert from "node:assert/strict";
import test from "node:test";

process.env.AB_ALLOW_TEST_IDENTITY = "1";

import { createTestDb } from "./db-helper.mjs";
import { handleAdminApi } from "../lib/admin/admin-api.ts";
import {
  ensureAdminBootstrap,
  resetAdminBootstrapCacheForTests,
} from "../lib/admin/admin-bootstrap.ts";
import { ADMIN_I18N, ADMIN_LOCALES } from "../lib/admin/i18n.ts";
import { roleHasPermission } from "../lib/admin/admin-auth.ts";
import { resetDashboardCacheForTests } from "../lib/admin/admin-queries.ts";
import { listPlayerAnnouncements } from "../lib/player-announcements.ts";
import { listPublicBanners, listPublicRecommendedGames } from "../lib/player-content.ts";
import {
  assertLocalesComplete,
  normalizeLocaleBundle,
} from "../lib/admin/admin-content-i18n.ts";

function adminRequest(path, { method = "GET", token, body } = {}) {
  const headers = {
    "content-type": "application/json",
    "cf-connecting-ip": "10.0.0.9",
    "x-request-id": "req-test-1f",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`http://admin.test/api/admin/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function slugOf(path) {
  return path.split("?")[0].split("/").filter(Boolean);
}

async function callAdmin(db, path, options) {
  const response = await handleAdminApi(db, adminRequest(path, options), slugOf(path));
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

async function freshDb() {
  resetAdminBootstrapCacheForTests();
  resetDashboardCacheForTests();
  const { db, sqlite } = createTestDb();
  await ensureAdminBootstrap(db);
  return { db, sqlite };
}

async function login(db) {
  return callAdmin(db, "login", { method: "POST", body: { username: "admin", password: "admin123" } });
}

test("ADMIN-1F i18n key parity ZH/EN/MY", () => {
  const zhKeys = Object.keys(ADMIN_I18N.zh).sort();
  for (const locale of ADMIN_LOCALES) {
    assert.deepEqual(Object.keys(ADMIN_I18N[locale]).sort(), zhKeys, `locale ${locale}`);
  }
  for (const key of ["nav.content", "content.publish", "content.playerImpactHint", "activities.noAdminCredit"]) {
    assert.ok(ADMIN_I18N.zh[key], key);
  }
});

test("ADMIN-1F content locale model + RBAC", () => {
  const normalized = normalizeLocaleBundle({ "zh-CN": "中", en: "EN", "my-MM": "မြ" });
  assert.equal(normalized.zh, "中");
  assert.equal(normalized.en, "EN");
  assert.equal(normalized.my, "မြ");
  assert.equal(assertLocalesComplete({ zh: "a", en: "", my: "c" }).ok, false);
  assert.equal(assertLocalesComplete({ zh: "a", en: "b", my: "c" }).ok, true);

  assert.equal(roleHasPermission("OPS", "content:view"), true);
  assert.equal(roleHasPermission("OPS", "content:publish"), true);
  assert.equal(roleHasPermission("SUPPORT", "content:view"), true);
  assert.equal(roleHasPermission("SUPPORT", "content:publish"), false);
  assert.equal(roleHasPermission("AUDIT", "content:view"), true);
  assert.equal(roleHasPermission("FINANCE", "content:edit"), false);
});

test("ADMIN-1F S-18 publish API enforces CONTENT_I18N_INCOMPLETE", async () => {
  const { db } = await freshDb();
  const auth = await login(db);
  assert.equal(auth.status, 200);
  const token = auth.data.token;

  const created = await callAdmin(db, "system/announcements", {
    method: "POST",
    token,
    body: {
      reason: "draft incomplete ok",
      title: "S18 draft",
      locales: { zh: "中文", en: "", my: "" },
      status: "UNPUBLISHED",
      level: "INFO",
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.id;

  const rejected = await callAdmin(db, `system/announcements/${id}/publish`, {
    method: "POST",
    token,
    body: { reason: "bypass frontend" },
  });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.data?.error?.code, "CONTENT_I18N_INCOMPLETE");

  // Complete locales via recreate then publish
  const full = await callAdmin(db, "system/announcements", {
    method: "POST",
    token,
    body: {
      reason: "full locales",
      title: "S18 full",
      locales: { zh: "中文公告", en: "English notice", my: "မြန်မာ ကြေညာချက်" },
      status: "UNPUBLISHED",
    },
  });
  assert.equal(full.status, 201);
  const published = await callAdmin(db, `system/announcements/${full.data.id}/publish`, {
    method: "POST",
    token,
    body: { reason: "publish with complete locales" },
  });
  assert.equal(published.status, 200, JSON.stringify(published.data));
  assert.equal(published.data.status, "PUBLISHED");

  const playerItems = await listPlayerAnnouncements(db);
  assert.ok(playerItems.some((a) => a.id === full.data.id));
  const item = playerItems.find((a) => a.id === full.data.id);
  assert.equal(item.locales.zh.includes("中文"), true);
  assert.equal(item.locales.en.includes("English"), true);
  assert.equal(item.locales.my.length > 0, true);

  const audit = await callAdmin(db, "logs/admin?action=announcement.publish&pageSize=20", { token });
  assert.equal(audit.status, 200);
  const hit = (audit.data.items ?? []).find((row) => row.targetId === full.data.id || row.target_id === full.data.id);
  assert.ok(hit || (audit.data.items ?? []).some((r) => String(r.action).includes("announcement.publish")));
});

test("ADMIN-1F banner + recommended games + media reject", async () => {
  const { db } = await freshDb();
  const auth = await login(db);
  const token = auth.data.token;

  assert.equal((await callAdmin(db, "content/banners")).status, 401);

  const meta = await callAdmin(db, "content/meta", { token });
  assert.equal(meta.status, 200);
  assert.equal(meta.data.mediaUpload, "NOT_AVAILABLE");
  assert.equal(meta.data.rewardPayout, "BLOCKED");

  const badMedia = await callAdmin(db, "content/banners", {
    method: "POST",
    token,
    body: {
      reason: "xss attempt",
      title: "bad",
      imageUrl: "javascript:alert(1)",
      locales: { zh: "a", en: "b", my: "c" },
    },
  });
  assert.equal(badMedia.status, 400);
  assert.equal(badMedia.data?.error?.code, "MEDIA_REJECTED");

  const created = await callAdmin(db, "content/banners", {
    method: "POST",
    token,
    body: {
      reason: "create banner",
      title: "Home Banner",
      imageUrl: "https://cdn.example.com/b.webp",
      locales: { zh: "欢迎", en: "Welcome", my: "ကြိုဆို" },
      textStrategy: "TRI_LOCALE",
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const bannerId = created.data.banner.id;

  const incompletePublish = await callAdmin(db, `content/banners/${bannerId}/publish`, {
    method: "POST",
    token,
    body: { reason: "should work complete" },
  });
  assert.equal(incompletePublish.status, 200);

  const playerBanners = await listPublicBanners(db);
  assert.ok(playerBanners.some((b) => b.id === bannerId));

  const fakeGame = await callAdmin(db, "content/recommended-games", {
    method: "POST",
    token,
    body: { reason: "fake", gameId: "does-not-exist", locales: { zh: "x", en: "y", my: "z" } },
  });
  assert.equal(fakeGame.status, 400);
  assert.equal(fakeGame.data?.error?.code, "INVALID_GAME");

  const okGame = await callAdmin(db, "content/recommended-games", {
    method: "POST",
    token,
    body: {
      reason: "official only",
      gameId: "bull-demon-king",
      enabled: true,
      locales: { zh: "牛魔王", en: "Bull Demon King", my: "BDK" },
    },
  });
  assert.equal(okGame.status, 200, JSON.stringify(okGame.data));
  const playerRec = await listPublicRecommendedGames(db);
  assert.ok(playerRec.every((g) => g.gameId === "bull-demon-king"));
});

test("ADMIN-1F activity payout blocked + vip high-risk blocked", async () => {
  const { db } = await freshDb();
  const auth = await login(db);
  const token = auth.data.token;

  const payout = await callAdmin(db, "activities", {
    method: "POST",
    token,
    body: {
      reason: "try payout",
      code: "EVT_X",
      rewardMinor: 100,
      title: { zh: "a", en: "b", my: "c" },
      creditPlayer: true,
    },
  });
  assert.equal(payout.status, 400);
  assert.equal(payout.data?.error?.code, "REWARD_PAYOUT_BLOCKED");

  const vip = await callAdmin(db, "vip/levels", {
    method: "POST",
    token,
    body: {
      reason: "rtp hack",
      level: 1,
      code: "V1",
      title: { zh: "a", en: "b", my: "c" },
      rtpBonus: 1.05,
    },
  });
  assert.equal(vip.status, 400);
  assert.equal(vip.data?.error?.code, "VIP_HIGH_RISK_BLOCKED");
});
