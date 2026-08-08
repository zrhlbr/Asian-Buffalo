/**
 * Phase 1 — XI GAME lobby smoke (catalog + i18n + route files present).
 * Playwright is not configured in package.json; this is the unit gate.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getLobbyCatalog, LOBBY_CATALOG_VERSION } from "../lib/lobby-catalog.ts";
import {
  assertLobbyI18nComplete,
  lobbyKeys,
  tLobby,
} from "../client/xi-lobby/i18n.ts";
import { GET as getLobbyCatalogRoute } from "../app/api/v1/lobby/catalog/route.ts";

const root = process.cwd();

test("lobby catalog seed includes live BDK and coming-soon myth cards", () => {
  const catalog = getLobbyCatalog();
  assert.equal(catalog.version, LOBBY_CATALOG_VERSION);
  assert.equal(catalog.platform.heroAsset, "placeholder");
  const bdk = catalog.games.find((g) => g.id === "bdk");
  assert.ok(bdk);
  assert.equal(bdk.status, "live");
  assert.equal(bdk.href, "/xi/bull-demon-king");
  for (const id of ["wukong", "nezha", "dragonking", "redboy", "bonespirit"]) {
    const card = catalog.games.find((g) => g.id === id);
    assert.ok(card, `missing ${id}`);
    assert.equal(card.status, "coming_soon");
  }
});

test("lobby catalog GET handler returns JSON", async () => {
  const res = await getLobbyCatalogRoute();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.version, LOBBY_CATALOG_VERSION);
  assert.ok(Array.isArray(body.games));
});

test("lobby i18n keys are complete across zh-CN / en / my-MM", () => {
  const check = assertLobbyI18nComplete();
  assert.deepEqual(check.missing, []);
  assert.equal(check.ok, true);
  assert.ok(lobbyKeys().length >= 40);
  assert.equal(tLobby("zh-CN", "lobby.brand"), "西游戏");
  assert.equal(tLobby("en", "lobby.brand"), "XI GAME");
  assert.ok(tLobby("my-MM", "lobby.games.bdk.title").length > 0);
});

test("Phase 1 route entry files exist (lobby + compat redirects)", () => {
  const required = [
    "app/page.tsx",
    "app/game/page.tsx",
    "app/xi/page.tsx",
    "app/xi/bdk/page.tsx",
    "app/xi/bull-demon-king/play/page.tsx",
    "app/admin/login/page.tsx",
    "app/api/v1/lobby/catalog/route.ts",
    "client/xi-lobby/lobby-app.tsx",
    "client/xi-lobby/bdk-hub.tsx",
    "docs/m8-review/xi-game-v2/phase-1/MODULE_IMPACT_ANALYSIS.md",
    "docs/m8-review/xi-game-v2/phase-1/ASSET_GAP.md",
  ];
  for (const rel of required) {
    assert.equal(existsSync(join(root, rel)), true, `missing ${rel}`);
  }
});

test("P0 canvas stacking rule still present in m5 styles (untouched)", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(join(root, "client/m5/styles.css"), "utf8");
  assert.match(css, /#gl\s*\{[\s\S]*?transform:\s*translateZ\(0\)/);
  assert.doesNotMatch(
    css,
    /#hud\s*\{[^}]*transform:\s*translateZ\(0\)/,
    "shell #hud must not use translateZ(0)",
  );
});
